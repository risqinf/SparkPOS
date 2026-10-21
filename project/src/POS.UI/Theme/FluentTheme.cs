using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace POS.UI.Theme;

public static class FluentTheme
{
    // Modern Retail POS Colors (Benchmarked against Moka / Toast / Square)
    public static readonly Color Background = ColorTranslator.FromHtml("#F8FAFC"); // Clean Modern Slate
    public static readonly Color Surface = Color.White;
    public static readonly Color SurfaceLow = ColorTranslator.FromHtml("#F1F5F9");
    public static readonly Color SurfaceContainer = ColorTranslator.FromHtml("#E2E8F0");
    public static readonly Color SurfaceHigh = ColorTranslator.FromHtml("#F1F5F9");
    public static readonly Color SurfaceHighest = ColorTranslator.FromHtml("#E2E8F0");

    public static readonly Color Primary = ColorTranslator.FromHtml("#2563EB"); // Modern Indigo / Action Blue
    public static readonly Color PrimaryDark = ColorTranslator.FromHtml("#1D4ED8");
    public static readonly Color PrimaryHover = ColorTranslator.FromHtml("#1E40AF");
    public static readonly Color PrimaryContainer = ColorTranslator.FromHtml("#DBEAFE");

    public static readonly Color Secondary = ColorTranslator.FromHtml("#10B981"); // Vibrant Emerald Green / Bayar
    public static readonly Color SecondaryHover = ColorTranslator.FromHtml("#059669");
    public static readonly Color SecondaryContainer = ColorTranslator.FromHtml("#D1FAE5");

    public static readonly Color Tertiary = ColorTranslator.FromHtml("#D97706"); // Amber
    public static readonly Color TertiaryContainer = ColorTranslator.FromHtml("#FEF3C7");

    public static readonly Color Danger = ColorTranslator.FromHtml("#EF4444"); // Coral Red
    public static readonly Color DangerHover = ColorTranslator.FromHtml("#DC2626");

    public static readonly Color TextPrimary = ColorTranslator.FromHtml("#0F172A"); // Slate 900
    public static readonly Color TextSecondary = ColorTranslator.FromHtml("#475569"); // Slate 600
    public static readonly Color TextMuted = ColorTranslator.FromHtml("#94A3B8"); // Slate 400

    public static readonly Color Border = ColorTranslator.FromHtml("#E2E8F0"); // Slate 200
    public static readonly Color BorderDark = ColorTranslator.FromHtml("#CBD5E1"); // Slate 300

    // Typography (Universal Segoe UI for robust scaling without text clipping)
    public static readonly Font DisplayTotalFont = new("Segoe UI", 26f, FontStyle.Bold, GraphicsUnit.Point);
    public static readonly Font HeadlineLgFont = new("Segoe UI", 15f, FontStyle.Bold, GraphicsUnit.Point);
    public static readonly Font HeadlineFont = new("Segoe UI", 11.5f, FontStyle.Bold, GraphicsUnit.Point);
    public static readonly Font SubheadFont = new("Segoe UI", 10f, FontStyle.Bold, GraphicsUnit.Point);
    public static readonly Font BodyFont = new("Segoe UI", 9.5f, FontStyle.Regular, GraphicsUnit.Point);
    public static readonly Font BodyBoldFont = new("Segoe UI", 9.5f, FontStyle.Bold, GraphicsUnit.Point);
    public static readonly Font BadgeFont = new("Segoe UI", 8.5f, FontStyle.Bold, GraphicsUnit.Point);

    public static GraphicsPath CreateRoundedRectangle(Rectangle rect, int radius)
    {
        var path = new GraphicsPath();
        if (radius <= 0)
        {
            path.AddRectangle(rect);
            return path;
        }

        int diameter = radius * 2;
        var arc = new Rectangle(rect.Location, new Size(diameter, diameter));

        // Top left
        path.AddArc(arc, 180, 90);

        // Top right
        arc.X = rect.Right - diameter;
        path.AddArc(arc, 270, 90);

        // Bottom right
        arc.Y = rect.Bottom - diameter;
        path.AddArc(arc, 0, 90);

        // Bottom left
        arc.X = rect.Left;
        path.AddArc(arc, 90, 90);

        path.CloseFigure();
        return path;
    }

    public static void ApplyModernGridStyle(DataGridView grid)
    {
        grid.BackgroundColor = Surface;
        grid.BorderStyle = BorderStyle.None;
        grid.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
        grid.GridColor = Border;
        grid.RowHeadersVisible = false;
        grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        grid.MultiSelect = false;
        grid.AllowUserToResizeRows = false;
        grid.EnableHeadersVisualStyles = false;
        grid.RowTemplate.Height = 38;
        grid.Font = BodyFont;

        // Header
        grid.ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None;
        grid.ColumnHeadersDefaultCellStyle.BackColor = SurfaceContainer;
        grid.ColumnHeadersDefaultCellStyle.ForeColor = TextPrimary;
        grid.ColumnHeadersDefaultCellStyle.Font = SubheadFont;
        grid.ColumnHeadersDefaultCellStyle.Padding = new Padding(8, 0, 8, 0);
        grid.ColumnHeadersHeight = 36;

        // Rows
        grid.DefaultCellStyle.BackColor = Surface;
        grid.DefaultCellStyle.ForeColor = TextPrimary;
        grid.DefaultCellStyle.SelectionBackColor = ColorTranslator.FromHtml("#EDF5FC");
        grid.DefaultCellStyle.SelectionForeColor = TextPrimary;
        grid.DefaultCellStyle.Padding = new Padding(8, 0, 8, 0);
    }
}
