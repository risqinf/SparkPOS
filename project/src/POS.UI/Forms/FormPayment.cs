using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;
using POS.Domain;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Forms;

public class FormPayment : Form
{
    private readonly decimal _grandTotal;
    private TextBox _txtPaidAmount = null!;
    private Label _lblChange = null!;
    private ModernButton _btnConfirm = null!;
    private ComboBox _cmbMethod = null!;

    public List<Payment> Payments { get; } = new();
    public decimal PaidAmount { get; private set; }
    public decimal ChangeAmount { get; private set; }

    public FormPayment(decimal grandTotal)
    {
        _grandTotal = grandTotal;
        InitializeComponent();
    }

    private void InitializeComponent()
    {
        Text = "Pembayaran Transaksi";
        Size = new Size(540, 520);
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;
        KeyPreview = true;

        var mainPanel = new ModernPanel
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(16),
            BackColor = FluentTheme.Surface
        };
        Controls.Add(mainPanel);

        // Header Grand Total
        var lblHeaderTotal = new Label
        {
            Text = "TOTAL TAGIHAN",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextSecondary,
            Location = new Point(24, 20),
            AutoSize = true
        };
        mainPanel.Controls.Add(lblHeaderTotal);

        var lblDisplayTotal = new Label
        {
            Text = $"Rp {_grandTotal:N0}",
            Font = FluentTheme.DisplayTotalFont,
            ForeColor = FluentTheme.Secondary,
            Location = new Point(20, 42),
            Size = new Size(480, 48)
        };
        mainPanel.Controls.Add(lblDisplayTotal);

        // Payment Method Dropdown
        var lblMethod = new Label
        {
            Text = "Metode Pembayaran:",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextPrimary,
            Location = new Point(24, 102),
            AutoSize = true
        };
        mainPanel.Controls.Add(lblMethod);

        _cmbMethod = new ComboBox
        {
            DropDownStyle = ComboBoxStyle.DropDownList,
            Font = FluentTheme.HeadlineFont,
            Location = new Point(24, 126),
            Size = new Size(470, 36)
        };
        _cmbMethod.Items.AddRange(new object[] { "Tunai (Cash)", "QRIS / E-Wallet", "Kartu Debit", "Kartu Kredit" });
        _cmbMethod.SelectedIndex = 0;
        _cmbMethod.SelectedIndexChanged += (s, e) =>
        {
            if (_cmbMethod.SelectedIndex != 0) // Non-cash defaults to exact amount
            {
                _txtPaidAmount.Text = _grandTotal.ToString("0");
            }
        };
        mainPanel.Controls.Add(_cmbMethod);

        // Paid Amount Input
        var lblPaid = new Label
        {
            Text = "Jumlah Bayar / Diterima (Rp):",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextPrimary,
            Location = new Point(24, 174),
            AutoSize = true
        };
        mainPanel.Controls.Add(lblPaid);

        _txtPaidAmount = new TextBox
        {
            Font = new Font("Segoe UI", 16f, FontStyle.Bold),
            Location = new Point(24, 198),
            Size = new Size(470, 40),
            TextAlign = HorizontalAlignment.Right,
            Text = _grandTotal.ToString("0")
        };
        _txtPaidAmount.TextChanged += (s, e) => UpdateChange();
        mainPanel.Controls.Add(_txtPaidAmount);

        // Quick Cash Buttons
        var quickFlow = new FlowLayoutPanel
        {
            Location = new Point(24, 252),
            Size = new Size(470, 44),
            WrapContents = false,
            AutoScroll = false
        };
        mainPanel.Controls.Add(quickFlow);

        decimal[] presets = { _grandTotal, 10000, 20000, 50000, 100000 };
        string[] presetLabels = { "Uang Pas", "Rp 10 rb", "Rp 20 rb", "Rp 50 rb", "Rp 100 rb" };

        for (int i = 0; i < presets.Length; i++)
        {
            decimal val = presets[i];
            string lbl = presetLabels[i];
            var btnPreset = new ModernButton
            {
                Text = lbl,
                Size = new Size(88, 36),
                NormalBackColor = FluentTheme.SurfaceHigh,
                HoverBackColor = FluentTheme.SurfaceContainer,
                NormalForeColor = FluentTheme.TextPrimary,
                ShowBorder = true,
                BorderColor = FluentTheme.BorderDark,
                Margin = new Padding(0, 0, 6, 0)
            };
            btnPreset.Click += (s, e) =>
            {
                _txtPaidAmount.Text = val.ToString("0");
                _txtPaidAmount.Focus();
                _txtPaidAmount.SelectAll();
            };
            quickFlow.Controls.Add(btnPreset);
        }

        // Kembalian Box
        var changePanel = new ModernPanel
        {
            Location = new Point(24, 308),
            Size = new Size(470, 72),
            BackColor = FluentTheme.SurfaceLow,
            ShowBorder = true,
            BorderColor = FluentTheme.Border
        };
        mainPanel.Controls.Add(changePanel);

        var lblChangeTitle = new Label
        {
            Text = "KEMBALIAN",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Location = new Point(14, 10),
            AutoSize = true
        };
        changePanel.Controls.Add(lblChangeTitle);

        _lblChange = new Label
        {
            Text = "Rp 0",
            Font = new Font("Segoe UI", 18f, FontStyle.Bold),
            ForeColor = FluentTheme.PrimaryDark,
            Location = new Point(12, 28),
            Size = new Size(440, 36)
        };
        changePanel.Controls.Add(_lblChange);

        // Buttons: Batal & Konfirmasi
        var btnCancel = new ModernButton
        {
            Text = "Batal",
            ShortcutKey = "ESC",
            Location = new Point(24, 400),
            Size = new Size(130, 48),
            NormalBackColor = FluentTheme.SurfaceHigh,
            HoverBackColor = FluentTheme.SurfaceContainer,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            BorderColor = FluentTheme.BorderDark
        };
        btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
        mainPanel.Controls.Add(btnCancel);

        _btnConfirm = new ModernButton
        {
            Text = "Bayar & Cetak",
            ShortcutKey = "ENTER",
            Location = new Point(164, 400),
            Size = new Size(330, 48),
            NormalBackColor = FluentTheme.Secondary,
            HoverBackColor = FluentTheme.SecondaryHover,
            NormalForeColor = Color.White
        };
        _btnConfirm.Click += (s, e) => ConfirmPayment();
        mainPanel.Controls.Add(_btnConfirm);

        KeyDown += (s, e) =>
        {
            if (e.KeyCode == Keys.Escape)
            {
                DialogResult = DialogResult.Cancel;
                Close();
            }
            else if (e.KeyCode == Keys.Enter)
            {
                ConfirmPayment();
            }
        };

        UpdateChange();
    }

    private void UpdateChange()
    {
        string raw = _txtPaidAmount.Text.Replace(".", "").Replace(",", "").Trim();
        if (decimal.TryParse(raw, out decimal paid))
        {
            PaidAmount = paid;
            decimal diff = paid - _grandTotal;
            if (diff >= 0)
            {
                ChangeAmount = diff;
                _lblChange.Text = $"Rp {diff:N0}";
                _lblChange.ForeColor = FluentTheme.Secondary;
                _btnConfirm.Enabled = true;
            }
            else
            {
                ChangeAmount = 0;
                _lblChange.Text = $"(Kurang Rp {Math.Abs(diff):N0})";
                _lblChange.ForeColor = FluentTheme.Danger;
                _btnConfirm.Enabled = false;
            }
        }
        else
        {
            _lblChange.Text = "Rp 0";
            _btnConfirm.Enabled = false;
        }
    }

    private void ConfirmPayment()
    {
        if (PaidAmount < _grandTotal)
        {
            MessageBox.Show("Nominal pembayaran belum mencukupi total tagihan.", "Perhatian", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        PaymentMethod method = _cmbMethod.SelectedIndex switch
        {
            1 => PaymentMethod.Qris,
            2 => PaymentMethod.Debit,
            3 => PaymentMethod.Credit,
            _ => PaymentMethod.Cash
        };

        Payments.Clear();
        Payments.Add(new Payment
        {
            Method = method,
            Amount = PaidAmount,
            CreatedAt = DateTime.Now
        });

        DialogResult = DialogResult.OK;
        Close();
    }
}
