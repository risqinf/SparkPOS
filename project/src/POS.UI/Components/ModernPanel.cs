using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using POS.UI.Theme;

namespace POS.UI.Components;

public class ModernPanel : Panel
{
    public Color BorderColor { get; set; } = FluentTheme.Border;
    public int CornerRadius { get; set; } = 16;
    public bool ShowBorder { get; set; } = true;

    public ModernPanel()
    {
        SetStyle(ControlStyles.UserPaint |
                 ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer |
                 ControlStyles.ResizeRedraw, true);

        BackColor = FluentTheme.Surface;
        Padding = new Padding(12);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;

        var rect = new Rectangle(0, 0, Width - 1, Height - 1);

        using (var path = FluentTheme.CreateRoundedRectangle(rect, CornerRadius))
        {
            using (var brush = new SolidBrush(BackColor))
            {
                g.FillPath(brush, path);
            }

            if (ShowBorder)
            {
                using var pen = new Pen(BorderColor, 1.2f);
                g.DrawPath(pen, path);
            }
        }
    }
}
