using System;
using System.Drawing;
using System.Windows.Forms;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Forms;

public class FormDiscount : Form
{
    private RadioButton _rbPercent = null!;
    private RadioButton _rbNominal = null!;
    private TextBox _txtAmount = null!;

    public bool IsPercentage => _rbPercent.Checked;
    public decimal DiscountValue { get; private set; }

    public FormDiscount(decimal currentPercent = 0, decimal currentNominal = 0)
    {
        InitializeComponent(currentPercent, currentNominal);
    }

    private void InitializeComponent(decimal currentPercent, decimal currentNominal)
    {
        Text = "Diskon Nota Penjualan";
        Size = new Size(380, 260);
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;

        var panel = new ModernPanel
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(12),
            BackColor = FluentTheme.Surface
        };
        Controls.Add(panel);

        var lblTitle = new Label
        {
            Text = "Terapkan Diskon Transaksi",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Location = new Point(20, 16),
            AutoSize = true
        };
        panel.Controls.Add(lblTitle);

        _rbPercent = new RadioButton
        {
            Text = "Persentase (%)",
            Font = FluentTheme.SubheadFont,
            Location = new Point(24, 52),
            Size = new Size(130, 26),
            Checked = currentPercent > 0 || currentNominal == 0
        };
        panel.Controls.Add(_rbPercent);

        _rbNominal = new RadioButton
        {
            Text = "Nominal (Rp)",
            Font = FluentTheme.SubheadFont,
            Location = new Point(170, 52),
            Size = new Size(130, 26),
            Checked = currentNominal > 0
        };
        panel.Controls.Add(_rbNominal);

        _txtAmount = new TextBox
        {
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            Location = new Point(24, 90),
            Size = new Size(310, 36),
            TextAlign = HorizontalAlignment.Right,
            Text = (currentPercent > 0 ? currentPercent : currentNominal).ToString("0")
        };
        panel.Controls.Add(_txtAmount);

        var btnCancel = new ModernButton
        {
            Text = "Batal",
            ShortcutKey = "ESC",
            Location = new Point(24, 150),
            Size = new Size(100, 42),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true
        };
        btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
        panel.Controls.Add(btnCancel);

        var btnApply = new ModernButton
        {
            Text = "Terapkan Diskon",
            ShortcutKey = "ENTER",
            Location = new Point(134, 150),
            Size = new Size(200, 42),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White
        };
        btnApply.Click += (s, e) => Apply();
        panel.Controls.Add(btnApply);

        KeyDown += (s, e) =>
        {
            if (e.KeyCode == Keys.Escape) { DialogResult = DialogResult.Cancel; Close(); }
            else if (e.KeyCode == Keys.Enter) Apply();
        };
    }

    private void Apply()
    {
        string raw = _txtAmount.Text.Replace(".", "").Replace(",", "").Trim();
        if (decimal.TryParse(raw, out decimal val) && val >= 0)
        {
            DiscountValue = val;
            DialogResult = DialogResult.OK;
            Close();
        }
        else
        {
            MessageBox.Show("Masukkan nominal diskon yang valid.", "Perhatian", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }
}
