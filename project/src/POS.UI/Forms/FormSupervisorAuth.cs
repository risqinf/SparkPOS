using System;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Application;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Forms;

public class FormSupervisorAuth : Form
{
    private readonly AuthService _authService;
    private TextBox _txtPin = null!;
    private Label _lblStatus = null!;

    public bool IsAuthorized { get; private set; }

    public FormSupervisorAuth(AuthService authService, string actionDescription = "Otorisasi Supervisor Diperlukan")
    {
        _authService = authService;
        InitializeComponent(actionDescription);
    }

    private void InitializeComponent(string actionDescription)
    {
        Text = "Otorisasi Supervisor";
        Size = new Size(380, 280);
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
            Text = actionDescription,
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.Danger,
            Location = new Point(20, 20),
            Size = new Size(320, 40)
        };
        panel.Controls.Add(lblTitle);

        var lblPrompt = new Label
        {
            Text = "Masukkan PIN Supervisor / Admin:",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextPrimary,
            Location = new Point(20, 70),
            AutoSize = true
        };
        panel.Controls.Add(lblPrompt);

        _txtPin = new TextBox
        {
            Font = new Font("Segoe UI", 16f, FontStyle.Bold),
            Location = new Point(20, 96),
            Size = new Size(320, 38),
            PasswordChar = '●',
            TextAlign = HorizontalAlignment.Center
        };
        _txtPin.KeyDown += async (s, e) =>
        {
            if (e.KeyCode == Keys.Enter) await VerifyPin();
            else if (e.KeyCode == Keys.Escape) { DialogResult = DialogResult.Cancel; Close(); }
        };
        panel.Controls.Add(_txtPin);

        _lblStatus = new Label
        {
            Text = "",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.Danger,
            Location = new Point(20, 142),
            Size = new Size(320, 20)
        };
        panel.Controls.Add(_lblStatus);

        var btnCancel = new ModernButton
        {
            Text = "Batal",
            ShortcutKey = "ESC",
            Location = new Point(20, 175),
            Size = new Size(110, 42),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true
        };
        btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
        panel.Controls.Add(btnCancel);

        var btnVerify = new ModernButton
        {
            Text = "Verifikasi",
            ShortcutKey = "ENTER",
            Location = new Point(140, 175),
            Size = new Size(200, 42),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White
        };
        btnVerify.Click += async (s, e) => await VerifyPin();
        panel.Controls.Add(btnVerify);
    }

    private async Task VerifyPin()
    {
        string pin = _txtPin.Text.Trim();
        if (string.IsNullOrEmpty(pin))
        {
            _lblStatus.Text = "Harap masukkan PIN.";
            return;
        }

        bool ok = await _authService.VerifySupervisorPinAsync(pin);
        if (ok)
        {
            IsAuthorized = true;
            DialogResult = DialogResult.OK;
            Close();
        }
        else
        {
            _lblStatus.Text = "PIN Supervisor tidak valid atau hak akses kurang!";
            _txtPin.SelectAll();
            _txtPin.Focus();
        }
    }
}
