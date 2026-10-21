using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using POS.UI.Theme;

namespace POS.UI.Components;

public class ModernButton : Button
{
    private bool _isHovered;
    private bool _isPressed;

    public string? ShortcutKey { get; set; }
    public Color NormalBackColor { get; set; } = FluentTheme.Primary;
    public Color HoverBackColor { get; set; } = FluentTheme.PrimaryHover;
    public Color NormalForeColor { get; set; } = Color.White;
    public int CornerRadius { get; set; } = 18;
    public bool ShowBorder { get; set; } = false;
    public Color BorderColor { get; set; } = FluentTheme.Border;

    public ModernButton()
    {
        SetStyle(ControlStyles.UserPaint |
                 ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer |
                 ControlStyles.ResizeRedraw |
                 ControlStyles.SupportsTransparentBackColor, true);

        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        Cursor = Cursors.Hand;
        Font = FluentTheme.SubheadFont;
        Size = new Size(120, 40);
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
        _isPressed = false;
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnMouseDown(MouseEventArgs mevent)
    {
        _isPressed = true;
        Invalidate();
        base.OnMouseDown(mevent);
    }

    protected override void OnMouseUp(MouseEventArgs mevent)
    {
        _isPressed = false;
        Invalidate();
        base.OnMouseUp(mevent);
    }

    protected override void OnPaint(PaintEventArgs pevent)
    {
        var g = pevent.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        var rect = new Rectangle(0, 0, Width - 1, Height - 1);
        Color currentBg = NormalBackColor;

        if (!Enabled)
        {
            currentBg = FluentTheme.SurfaceHigh;
        }
        else if (_isPressed)
        {
            currentBg = ControlPaint.Dark(NormalBackColor, 0.1f);
        }
        else if (_isHovered)
        {
            currentBg = HoverBackColor;
        }

        int actualRadius = CornerRadius;
        if (actualRadius <= 0) actualRadius = Height / 2;
        actualRadius = Math.Min(actualRadius, Height / 2);

        using (var path = FluentTheme.CreateRoundedRectangle(rect, actualRadius))
        {
            using (var brush = new SolidBrush(currentBg))
            {
                g.FillPath(brush, path);
            }

            if (ShowBorder)
            {
                using var pen = new Pen(BorderColor, 1.2f);
                g.DrawPath(pen, path);
            }
        }

        // Draw Shortcut badge on the RIGHT edge if present
        int textOffsetRight = Width - 10;
        if (!string.IsNullOrEmpty(ShortcutKey))
        {
            var badgeSize = g.MeasureString(ShortcutKey, FluentTheme.BadgeFont);
            int badgeW = Math.Max(26, (int)badgeSize.Width + 10);
            int badgeH = Math.Min(Height - 10, (int)badgeSize.Height + 4);
            var badgeRect = new Rectangle(Width - badgeW - 10, (Height - badgeH) / 2, badgeW, badgeH);

            using (var badgePath = FluentTheme.CreateRoundedRectangle(badgeRect, badgeH / 2))
            {
                using var badgeBg = new SolidBrush(Color.FromArgb(45, 255, 255, 255));
                g.FillPath(badgeBg, badgePath);

                using var badgePen = new Pen(Color.FromArgb(90, 255, 255, 255), 1f);
                g.DrawPath(badgePen, badgePath);
            }

            using var badgeTextBrush = new SolidBrush(NormalForeColor);
            var sfBadge = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString(ShortcutKey, FluentTheme.BadgeFont, badgeTextBrush, badgeRect, sfBadge);

            textOffsetRight = badgeRect.Left - 8;
        }

        // Draw main text
        Color textColor = Enabled ? NormalForeColor : FluentTheme.TextMuted;
        using var textBrush = new SolidBrush(textColor);
        var textRect = new Rectangle(10, 0, Math.Max(0, textOffsetRight - 10), Height);
        var sfText = new StringFormat
        {
            Alignment = string.IsNullOrEmpty(ShortcutKey) ? StringAlignment.Center : StringAlignment.Near,
            LineAlignment = StringAlignment.Center,
            Trimming = StringTrimming.EllipsisCharacter,
            FormatFlags = StringFormatFlags.NoWrap
        };

        g.DrawString(Text, Font, textBrush, textRect, sfText);
    }
}
