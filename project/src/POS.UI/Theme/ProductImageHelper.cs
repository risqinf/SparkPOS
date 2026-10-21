using System;
using System.Collections.Concurrent;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

namespace POS.UI.Theme;

public static class ProductImageHelper
{
    private static readonly ConcurrentDictionary<string, Image> _imageCache = new();
    private static readonly string ImagesDir;

    static ProductImageHelper()
    {
        ImagesDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SparkPOS", "Images");
        Directory.CreateDirectory(ImagesDir);
        EnsureDefaultProductImages();
    }

    public static Image GetProductImage(string? imagePath, string productName, int width = 180, int height = 110)
    {
        string key = $"{imagePath}_{productName}_{width}_{height}";
        if (_imageCache.TryGetValue(key, out var cached))
            return cached;

        // 1. Try loading from file
        if (!string.IsNullOrEmpty(imagePath))
        {
            string fullPath = Path.IsPathRooted(imagePath) ? imagePath : Path.Combine(ImagesDir, imagePath);
            if (File.Exists(fullPath))
            {
                try
                {
                    using var original = Image.FromFile(fullPath);
                    var scaled = ResizeImage(original, width, height);
                    _imageCache[key] = scaled;
                    return scaled;
                }
                catch { }
            }
        }

        // 2. Generate a stylish branded retail vector artwork (no emojis)
        var generated = GenerateProductArtwork(productName, width, height);
        _imageCache[key] = generated;
        return generated;
    }

    public static string SaveCustomProductImage(string sourceFilePath, string sku)
    {
        try
        {
            string ext = Path.GetExtension(sourceFilePath);
            if (string.IsNullOrEmpty(ext)) ext = ".png";
            string fileName = $"prod_{sku.ToLowerInvariant().Replace("-", "_")}{ext}";
            string dest = Path.Combine(ImagesDir, fileName);

            using var img = Image.FromFile(sourceFilePath);
            using var resized = ResizeImage(img, 400, 280);
            resized.Save(dest, ImageFormat.Png);

            _imageCache.Clear();
            return fileName;
        }
        catch
        {
            return string.Empty;
        }
    }

    private static Image ResizeImage(Image original, int width, int height)
    {
        var destRect = new Rectangle(0, 0, width, height);
        var destImage = new Bitmap(width, height);

        destImage.SetResolution(original.HorizontalResolution, original.VerticalResolution);

        using var g = Graphics.FromImage(destImage);
        g.CompositingMode = CompositingMode.SourceCopy;
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.SmoothingMode = SmoothingMode.HighQuality;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;

        using var wrapMode = new ImageAttributes();
        wrapMode.SetWrapMode(WrapMode.TileFlipXY);
        g.DrawImage(original, destRect, 0, 0, original.Width, original.Height, GraphicsUnit.Pixel, wrapMode);

        return destImage;
    }

    public static Bitmap GenerateProductArtwork(string productName, int width, int height)
    {
        var bmp = new Bitmap(width, height);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        var theme = GetThemeForProduct(productName);

        // 1. Subtle Modern Gradient Backdrop
        using (var brush = new LinearGradientBrush(new Point(0, 0), new Point(width, height), theme.GradStart, theme.GradEnd))
        {
            g.FillRectangle(brush, 0, 0, width, height);
        }

        // Geometric background curves
        using (var decBrush = new SolidBrush(Color.FromArgb(18, 255, 255, 255)))
        {
            g.FillEllipse(decBrush, width - 60, -20, 90, 90);
            g.FillEllipse(decBrush, -25, height - 55, 80, 80);
        }

        // 2. Center Card (Packaging Container Silhouette)
        int cardW = Math.Min(width - 32, 105);
        int cardH = height - 16;
        int cardX = (width - cardW) / 2;
        int cardY = 8;

        var cardRect = new Rectangle(cardX, cardY, cardW, cardH);
        using (var cardPath = FluentTheme.CreateRoundedRectangle(cardRect, 6))
        {
            using var shadowBrush = new SolidBrush(Color.FromArgb(25, 0, 0, 0));
            g.FillRectangle(shadowBrush, cardX + 2, cardY + 2, cardW, cardH);

            using var whiteBrush = new SolidBrush(Color.White);
            g.FillPath(whiteBrush, cardPath);

            using var pen = new Pen(Color.FromArgb(50, theme.AccentColor), 1f);
            g.DrawPath(pen, cardPath);
        }

        // 3. Category Top Ribbon
        var ribbonRect = new Rectangle(cardX, cardY, cardW, 18);
        using (var ribPath = new GraphicsPath())
        {
            ribPath.AddArc(cardX, cardY, 8, 8, 180, 90);
            ribPath.AddArc(cardX + cardW - 8, cardY, 8, 8, 270, 90);
            ribPath.AddLine(cardX + cardW, cardY + 18, cardX, cardY + 18);
            ribPath.CloseFigure();

            using var ribBrush = new SolidBrush(theme.AccentColor);
            g.FillPath(ribBrush, ribPath);
        }

        using (var ribTextBrush = new SolidBrush(Color.White))
        {
            var sfRib = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            using var ribFont = new Font("Segoe UI", 7.5f, FontStyle.Bold);
            g.DrawString(theme.CategoryLabel, ribFont, ribTextBrush, ribbonRect, sfRib);
        }

        // 4. Vector Packaging Icon (Pure GDI+ Geometry - NO EMOJI)
        DrawVectorIcon(g, theme.IconType, cardX + (cardW / 2), cardY + 36, theme.AccentColor);

        // 5. Short Brand Name
        string brand = GetShortBadge(productName);
        using (var textBrush = new SolidBrush(ColorTranslator.FromHtml("#1E293B")))
        {
            using var textFont = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            var sf = new StringFormat
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center,
                Trimming = StringTrimming.EllipsisCharacter
            };
            g.DrawString(brand, textFont, textBrush, new RectangleF(cardX + 2, cardY + 54, cardW - 4, 20), sf);
        }

        // 6. Realistic Retail Barcode Simulation Strip at the Bottom
        DrawBarcodeStrip(g, cardX + 8, cardY + cardH - 16, cardW - 16, 10);

        return bmp;
    }

    private static void DrawBarcodeStrip(Graphics g, int x, int y, int w, int h)
    {
        // Draw alternating black/white stripes like retail FMCG barcodes
        using var barBrush = new SolidBrush(Color.FromArgb(180, 50, 60, 70));
        int curX = x;
        int[] pattern = { 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 3, 2, 1, 1, 2, 2, 1, 1, 2 };
        int i = 0;
        while (curX < x + w && i < pattern.Length)
        {
            int barW = pattern[i % pattern.Length];
            if (i % 2 == 0 && curX + barW <= x + w)
            {
                g.FillRectangle(barBrush, curX, y, barW, h);
            }
            curX += barW + 1;
            i++;
        }
    }

    private static void DrawVectorIcon(Graphics g, IconKind kind, int cx, int cy, Color color)
    {
        using var pen = new Pen(color, 2f);
        pen.StartCap = LineCap.Round;
        pen.EndCap = LineCap.Round;
        using var brush = new SolidBrush(Color.FromArgb(40, color));
        using var solidBrush = new SolidBrush(color);

        switch (kind)
        {
            case IconKind.Bottle:
                // Retail bottle silhouette (Water / Beverage)
                g.FillRectangle(brush, cx - 7, cy - 6, 14, 22);
                g.DrawRectangle(pen, cx - 7, cy - 6, 14, 22);
                g.FillRectangle(solidBrush, cx - 4, cy - 12, 8, 6); // Cap
                g.DrawLine(pen, cx - 5, cy + 2, cx + 5, cy + 2);   // Label line
                break;

            case IconKind.Pouch:
                // Retail snack / instant noodle pouch silhouette
                var pouchPoints = new Point[]
                {
                    new(cx - 11, cy - 10),
                    new(cx + 11, cy - 10),
                    new(cx + 9, cy + 12),
                    new(cx - 9, cy + 12)
                };
                g.FillPolygon(brush, pouchPoints);
                g.DrawPolygon(pen, pouchPoints);
                g.DrawLine(pen, cx - 8, cy - 4, cx + 8, cy - 4);
                g.DrawLine(pen, cx - 6, cy + 2, cx + 6, cy + 2);
                break;

            case IconKind.Jug:
                // Cooking oil 2L gallon / jug silhouette
                g.FillRectangle(brush, cx - 11, cy - 7, 22, 21);
                g.DrawRectangle(pen, cx - 11, cy - 7, 22, 21);
                g.FillRectangle(solidBrush, cx - 6, cy - 12, 6, 5); // Cap off-center
                // Handle loop
                g.DrawArc(pen, cx + 5, cy - 6, 8, 12, 270, 180);
                break;

            case IconKind.Cup:
                // Coffee / hot drink cup silhouette
                var cupPoints = new Point[]
                {
                    new(cx - 9, cy - 8),
                    new(cx + 9, cy - 8),
                    new(cx + 6, cy + 11),
                    new(cx - 6, cy + 11)
                };
                g.FillPolygon(brush, cupPoints);
                g.DrawPolygon(pen, cupPoints);
                // Handle
                g.DrawArc(pen, cx + 5, cy - 5, 8, 10, 270, 180);
                // Steam curves
                g.DrawLine(pen, cx - 3, cy - 11, cx - 3, cy - 13);
                g.DrawLine(pen, cx + 2, cy - 11, cx + 2, cy - 13);
                break;

            case IconKind.Leaf:
                // Tea / organic botanical leaf silhouette
                g.DrawArc(pen, cx - 9, cy - 10, 18, 20, 0, 90);
                g.DrawArc(pen, cx - 9, cy - 10, 18, 20, 180, 90);
                g.DrawLine(pen, cx, cy - 9, cx, cy + 9);
                break;

            case IconKind.Sack:
                // Rice / flour sack silhouette
                g.FillEllipse(brush, cx - 11, cy - 6, 22, 18);
                g.DrawEllipse(pen, cx - 11, cy - 6, 22, 18);
                g.FillRectangle(solidBrush, cx - 6, cy - 11, 12, 5); // Knot
                g.DrawLine(pen, cx - 4, cy + 2, cx + 4, cy + 2);
                break;

            case IconKind.Carton:
            default:
                // Standard retail box / packaging carton
                g.FillRectangle(brush, cx - 10, cy - 9, 20, 20);
                g.DrawRectangle(pen, cx - 10, cy - 9, 20, 20);
                g.DrawLine(pen, cx - 10, cy - 1, cx + 10, cy - 1);
                g.DrawLine(pen, cx, cy - 9, cx, cy - 1);
                break;
        }
    }

    private enum IconKind
    {
        Bottle,
        Pouch,
        Jug,
        Cup,
        Leaf,
        Sack,
        Carton
    }

    private static (Color GradStart, Color GradEnd, Color AccentColor, string CategoryLabel, IconKind IconType) GetThemeForProduct(string name)
    {
        string n = name.ToLowerInvariant();

        if (n.Contains("minyak") || n.Contains("sania") || n.Contains("bimoli") || n.Contains("filma"))
            return (ColorTranslator.FromHtml("#FEF3C7"), ColorTranslator.FromHtml("#FDE68A"), ColorTranslator.FromHtml("#D97706"), "MINYAK", IconKind.Jug);

        if (n.Contains("mie") || n.Contains("indomie") || n.Contains("sedap") || n.Contains("sarimi"))
            return (ColorTranslator.FromHtml("#FEE2E2"), ColorTranslator.FromHtml("#FECACA"), ColorTranslator.FromHtml("#DC2626"), "MIE INSTAN", IconKind.Pouch);

        if (n.Contains("aqua") || n.Contains("mineral") || n.Contains("cleo") || n.Contains("le minerale"))
            return (ColorTranslator.FromHtml("#E0F2FE"), ColorTranslator.FromHtml("#BAE6FD"), ColorTranslator.FromHtml("#0284C7"), "AIR MINERAL", IconKind.Bottle);

        if (n.Contains("teh") || n.Contains("sosro") || n.Contains("pucuk") || n.Contains("frestea"))
            return (ColorTranslator.FromHtml("#ECFCCB"), ColorTranslator.FromHtml("#D9F99D"), ColorTranslator.FromHtml("#65A30D"), "TEH", IconKind.Leaf);

        if (n.Contains("kopi") || n.Contains("kapal api") || n.Contains("torabika") || n.Contains("luwak"))
            return (ColorTranslator.FromHtml("#F5EBE6"), ColorTranslator.FromHtml("#E6D7D0"), ColorTranslator.FromHtml("#78350F"), "KOPI", IconKind.Cup);

        if (n.Contains("chitato") || n.Contains("snack") || n.Contains("oreo") || n.Contains("tango") || n.Contains("lays"))
            return (ColorTranslator.FromHtml("#FEF9C3"), ColorTranslator.FromHtml("#FEF08A"), ColorTranslator.FromHtml("#CA8A04"), "SNACK", IconKind.Pouch);

        if (n.Contains("beras") || n.Contains("ramos") || n.Contains("pandan wangi"))
            return (ColorTranslator.FromHtml("#F1F5F9"), ColorTranslator.FromHtml("#E2E8F0"), ColorTranslator.FromHtml("#475569"), "BERAS", IconKind.Sack);

        if (n.Contains("gula") || n.Contains("gulaku") || n.Contains("rose brand"))
            return (ColorTranslator.FromHtml("#F3E8FF"), ColorTranslator.FromHtml("#E9D5FF"), ColorTranslator.FromHtml("#9333EA"), "GULA", IconKind.Pouch);

        if (n.Contains("sabun") || n.Contains("shampo") || n.Contains("deterjen") || n.Contains("rinso") || n.Contains("lifebuoy"))
            return (ColorTranslator.FromHtml("#CCFBF1"), ColorTranslator.FromHtml("#99F6E4"), ColorTranslator.FromHtml("#0D9488"), "PERAWATAN", IconKind.Bottle);

        return (ColorTranslator.FromHtml("#E0E7FF"), ColorTranslator.FromHtml("#C7D2FE"), ColorTranslator.FromHtml("#4338CA"), "RETAIL", IconKind.Carton);
    }

    private static string GetShortBadge(string name)
    {
        var words = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 1) return words[0];
        if (words.Length >= 2) return $"{words[0]} {words[1]}";
        return name;
    }

    private static void EnsureDefaultProductImages()
    {
        string[] files = {
            "sania_2l.png", "indomie_goreng.png", "indomie_kuah.png",
            "aqua_600ml.png", "tehbotol_250ml.png", "kapalapi_mix.png",
            "chitato_68g.png", "oreo_133g.png", "beras_5kg.png", "gulaku_1kg.png"
        };

        string[] names = {
            "Minyak Goreng Sania 2L", "Indomie Goreng Spesial 85g", "Indomie Kuah Ayam Bawang 69g",
            "Aqua Air Mineral 600ml", "Teh Botol Sosro Kotak 250ml", "Kopi Kapal Api Spesial Mix 10s",
            "Chitato Sapi Panggang 68g", "Oreo Vanilla Roll 133g", "Beras Ramos Super 5kg", "Gulaku Premium Putih 1kg"
        };

        for (int i = 0; i < files.Length; i++)
        {
            string path = Path.Combine(ImagesDir, files[i]);
            // Always regenerate so fresh vector retail artwork replaces any old emoji images
            try
            {
                using var bmp = GenerateProductArtwork(names[i], 320, 200);
                bmp.Save(path, ImageFormat.Png);
            }
            catch { }
        }
    }
}
