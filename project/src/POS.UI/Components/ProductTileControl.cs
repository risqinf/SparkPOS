using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using POS.Domain;
using POS.UI.Theme;

namespace POS.UI.Components;

public class ProductTileControl : Control
{
    private bool _isHovered;
    public Product Product { get; }

    public event EventHandler<Product>? ProductSelected;

    public ProductTileControl(Product product)
    {
        Product = product;
        Size = new Size(195, 235);
        Cursor = Cursors.Hand;

        SetStyle(ControlStyles.UserPaint |
                 ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer |
                 ControlStyles.ResizeRedraw, true);
    }

    protected override void OnMouseEnter(EventArgs e)
    {
        _isHovered = true;
        Invalidate();
        base.OnMouseEnter(e);
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        _isHovered = false;
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnClick(EventArgs e)
    {
        ProductSelected?.Invoke(this, Product);
        base.OnClick(e);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        var cardRect = new Rectangle(0, 0, Width - 1, Height - 1);
        Color bg = _isHovered ? FluentTheme.SurfaceLow : FluentTheme.Surface;
        Color border = _isHovered ? FluentTheme.Primary : FluentTheme.Border;

        // 1. Draw Card Background & Rounded Border (Smooth modern 16px radius)
        using (var cardPath = FluentTheme.CreateRoundedRectangle(cardRect, 16))
        {
            using (var brush = new SolidBrush(bg))
            {
                g.FillPath(brush, cardPath);
            }

            using var pen = new Pen(border, _isHovered ? 1.5f : 1f);
            g.DrawPath(pen, cardPath);
        }

        // 2. PRODUCT PHOTO (Top Half: 0 to 115px)
        int imgH = 115;
        var imgRect = new Rectangle(1, 1, Width - 2, imgH);
        var prodImg = ProductImageHelper.GetProductImage(Product.ImagePath, Product.Name, imgRect.Width, imgRect.Height);

        // Clip photo to top rounded corners (radius 16)
        using (var topPath = new GraphicsPath())
        {
            int r = 16;
            int d = r * 2;
            topPath.AddArc(1, 1, d, d, 180, 90);
            topPath.AddArc(Width - 1 - d, 1, d, d, 270, 90);
            topPath.AddLine(Width - 1, imgH, 1, imgH);
            topPath.CloseFigure();

            var oldClip = g.Clip;
            g.SetClip(topPath, CombineMode.Intersect);
            g.DrawImage(prodImg, imgRect);
            g.Clip = oldClip;
        }

        // Divider line under photo
        using (var imgLinePen = new Pen(FluentTheme.Border, 1f))
        {
            g.DrawLine(imgLinePen, 1, imgH, Width - 2, imgH);
        }

        // 3. UNIT / CATEGORY BADGE (Top Left overlay on image - Pill Shape)
        string unitText = string.IsNullOrWhiteSpace(Product.UnitName) ? "Item" : Product.UnitName;
        var unitSize = g.MeasureString(unitText, FluentTheme.BadgeFont);
        int unitW = Math.Max(38, (int)unitSize.Width + 12);
        int badgeH = 22;
        var unitRect = new Rectangle(8, 8, unitW, badgeH);

        using (var unitPath = FluentTheme.CreateRoundedRectangle(unitRect, badgeH / 2))
        {
            using var brush = new SolidBrush(Color.FromArgb(200, 15, 23, 42)); // Dark Slate translucent
            g.FillPath(brush, unitPath);
        }

        using (var textBrush = new SolidBrush(Color.White))
        {
            var sfUnit = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString(unitText, FluentTheme.BadgeFont, textBrush, unitRect, sfUnit);
        }

        // 4. STOCK BADGE (Top Right overlay on image) — "foto produk itu ada stock nya"
        string stockText;
        Color stockBg;
        Color stockFg = Color.White;

        if (Product.Stock <= 0)
        {
            stockText = "HABIS (0)";
            stockBg = Color.FromArgb(235, 220, 38, 38); // Crimson Red
        }
        else if (Product.Stock <= Product.MinStock)
        {
            stockText = $"SISA {Product.Stock:0.#}";
            stockBg = Color.FromArgb(235, 217, 119, 6); // Amber
        }
        else
        {
            stockText = $"STOK {Product.Stock:0.#}";
            stockBg = Color.FromArgb(235, 5, 150, 105); // Emerald Green
        }

        var stockSize = g.MeasureString(stockText, FluentTheme.BadgeFont);
        int badgeW = (int)stockSize.Width + 14;
        var stockRect = new Rectangle(Width - badgeW - 8, 8, badgeW, badgeH);

        using (var badgePath = FluentTheme.CreateRoundedRectangle(stockRect, badgeH / 2))
        {
            using var brush = new SolidBrush(stockBg);
            g.FillPath(brush, badgePath);

            using var pen = new Pen(Color.FromArgb(40, 255, 255, 255), 1f);
            g.DrawPath(pen, badgePath);
        }

        using (var textBrush = new SolidBrush(stockFg))
        {
            var sfStock = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString(stockText, FluentTheme.BadgeFont, textBrush, stockRect, sfStock);
        }

        // 5. PRODUCT NAME (Y: 122 to 160)
        using (var nameBrush = new SolidBrush(FluentTheme.TextPrimary))
        {
            var nameRect = new RectangleF(10, 122, Width - 20, 38);
            var sfName = new StringFormat
            {
                Alignment = StringAlignment.Near,
                LineAlignment = StringAlignment.Near,
                Trimming = StringTrimming.EllipsisWord
            };
            g.DrawString(Product.Name, FluentTheme.BodyBoldFont, nameBrush, nameRect, sfName);
        }

        // 6. SKU & BARCODE (Y: 162 to 178)
        using (var catBrush = new SolidBrush(FluentTheme.TextMuted))
        {
            var catRect = new RectangleF(10, 162, Width - 20, 16);
            var sfCat = new StringFormat
            {
                Alignment = StringAlignment.Near,
                LineAlignment = StringAlignment.Center,
                Trimming = StringTrimming.EllipsisCharacter
            };
            string subText = string.IsNullOrEmpty(Product.Barcode) ? Product.Sku : $"{Product.Sku} • {Product.Barcode}";
            g.DrawString(subText, FluentTheme.BadgeFont, catBrush, catRect, sfCat);
        }

        // 7. STOCK HEALTH PROGRESS LINE (Y: 182)
        int barY = 182;
        using (var barBgPen = new Pen(ColorTranslator.FromHtml("#E2E8F0"), 2f))
        {
            g.DrawLine(barBgPen, 10, barY, Width - 10, barY);
        }

        Color barColor = Product.Stock <= 0 ? ColorTranslator.FromHtml("#DC2626") :
                         Product.Stock <= Product.MinStock ? ColorTranslator.FromHtml("#D97706") :
                         ColorTranslator.FromHtml("#059669");

        float fillRatio = Product.MinStock > 0 ? Math.Clamp((float)(Product.Stock / (Product.MinStock * 2m)), 0.05f, 1f) : (Product.Stock > 0 ? 1f : 0.05f);
        int fillW = (int)((Width - 20) * fillRatio);
        using (var barFillPen = new Pen(barColor, 2f))
        {
            g.DrawLine(barFillPen, 10, barY, 10 + fillW, barY);
        }

        // 8. PRICE & QUICK ADD BUTTON (Y: 194 to 226)
        string priceText = $"Rp {Product.SellPrice:N0}";
        using (var priceBrush = new SolidBrush(FluentTheme.Secondary))
        {
            var priceRect = new RectangleF(10, 194, Width - 50, 28);
            var sfPrice = new StringFormat
            {
                Alignment = StringAlignment.Near,
                LineAlignment = StringAlignment.Center
            };
            g.DrawString(priceText, FluentTheme.HeadlineFont, priceBrush, priceRect, sfPrice);
        }

        // True Circular Quick Add (+) Button on bottom right (Radius = 15)
        var addBtnRect = new Rectangle(Width - 40, 192, 30, 30);
        using (var addPath = FluentTheme.CreateRoundedRectangle(addBtnRect, 15))
        {
            using var brush = new SolidBrush(_isHovered ? FluentTheme.Primary : FluentTheme.PrimaryContainer);
            g.FillPath(brush, addPath);

            using var textBrush = new SolidBrush(_isHovered ? Color.White : FluentTheme.PrimaryDark);
            var sfAdd = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString("+", new Font("Segoe UI", 13f, FontStyle.Bold), textBrush, addBtnRect, sfAdd);
        }
    }
}
