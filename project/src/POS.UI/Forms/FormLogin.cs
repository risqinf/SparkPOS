using System;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Application;
using POS.Domain;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Forms;

public class FormLogin : Form
{
    private readonly AuthService _authService;
    private TextBox _txtUsername = null!;
    private TextBox _txtPassword = null!;
    private Label _lblError = null!;
    private ModernButton _btnLogin = null!;

    public bool AllowExit { get; set; } = false;

    public FormLogin(AuthService authService)
    {
        _authService = authService;
        InitializeComponent();
    }

    private void InitializeComponent()
    {
        Text = "Login Pengguna — Spark POS";
        Size = new Size(520, 580);
        StartPosition = FormStartPosition.CenterScreen;
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
            Padding = new Padding(32, 24, 32, 20),
            BackColor = FluentTheme.Surface,
            ShowBorder = true,
            BorderColor = FluentTheme.Border,
            CornerRadius = 20
        };
        Controls.Add(mainPanel);

        // Header Title (Large height to avoid any vertical text clipping across all DPI scales)
        var lblLogo = new Label
        {
            Text = "SPARK POS RETAIL",
            Font = new Font("Segoe UI", 18f, FontStyle.Bold),
            ForeColor = FluentTheme.PrimaryDark,
            Dock = DockStyle.Top,
            Height = 44,
            TextAlign = ContentAlignment.MiddleCenter
        };
        mainPanel.Controls.Add(lblLogo);

        var lblSub = new Label
        {
            Text = "Sistem Kasir Ritel Native Modern (Offline)",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Top,
            Height = 28,
            TextAlign = ContentAlignment.MiddleCenter
        };
        mainPanel.Controls.Add(lblSub);

        // Quick Role Selection Pill (Pill shaped, comfortable for mouse and touch)
        var pnlChips = new Panel
        {
            Dock = DockStyle.Top,
            Height = 46,
            Padding = new Padding(0, 4, 0, 4)
        };
        mainPanel.Controls.Add(pnlChips);

        var btnQuickAdmin = new ModernButton
        {
            Text = "Isi Kredensial Administrator (123456)",
            Dock = DockStyle.Fill,
            NormalBackColor = FluentTheme.PrimaryContainer,
            HoverBackColor = FluentTheme.Primary,
            NormalForeColor = FluentTheme.PrimaryDark,
            ShowBorder = true,
            BorderColor = FluentTheme.BorderDark,
            Font = FluentTheme.BodyBoldFont,
            CornerRadius = 18
        };
        btnQuickAdmin.Click += (s, e) =>
        {
            _txtUsername.Text = "Administrator";
            _txtPassword.Text = "123456";
            _txtPassword.Focus();
            _txtPassword.SelectAll();
        };
        pnlChips.Controls.Add(btnQuickAdmin);

        // Fields Container
        var pnlFields = new Panel
        {
            Dock = DockStyle.Top,
            Height = 200,
            Padding = new Padding(0, 12, 0, 0)
        };
        mainPanel.Controls.Add(pnlFields);

        var lblUser = new Label
        {
            Text = "Username Pengguna:",
            Font = FluentTheme.BodyBoldFont,
            ForeColor = FluentTheme.TextPrimary,
            Location = new Point(0, 12),
            AutoSize = true
        };
        pnlFields.Controls.Add(lblUser);

        _txtUsername = new TextBox
        {
            Font = new Font("Segoe UI", 12f),
            Location = new Point(0, 36),
            Size = new Size(450, 34),
            Text = "Administrator",
            PlaceholderText = "Masukkan username (contoh: Administrator)"
        };
        pnlFields.Controls.Add(_txtUsername);

        var lblPass = new Label
        {
            Text = "Password / PIN:",
            Font = FluentTheme.BodyBoldFont,
            ForeColor = FluentTheme.TextPrimary,
            Location = new Point(0, 80),
            AutoSize = true
        };
        pnlFields.Controls.Add(lblPass);

        _txtPassword = new TextBox
        {
            Font = new Font("Segoe UI", 12f),
            Location = new Point(0, 104),
            Size = new Size(450, 34),
            PasswordChar = '●',
            Text = "123456",
            PlaceholderText = "Masukkan Password atau PIN"
        };
        pnlFields.Controls.Add(_txtPassword);

        _lblError = new Label
        {
            Text = "",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.Danger,
            Location = new Point(0, 146),
            Size = new Size(450, 44)
        };
        pnlFields.Controls.Add(_lblError);

        // Hint Footer (Positioned cleanly at bottom)
        var lblHint = new Label
        {
            Text = "Kredensial Default: Administrator / 123456  •  Kelola kasir di Panel Admin",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextMuted,
            Dock = DockStyle.Bottom,
            Height = 28,
            TextAlign = ContentAlignment.MiddleCenter
        };
        mainPanel.Controls.Add(lblHint);

        // Action Buttons
        var pnlActions = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 56,
            Padding = new Padding(0, 4, 0, 4)
        };
        mainPanel.Controls.Add(pnlActions);

        var btnCancel = new ModernButton
        {
            Text = "Batal",
            ShortcutKey = "ESC",
            Size = new Size(130, 46),
            Dock = DockStyle.Left,
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextSecondary,
            ShowBorder = true,
            BorderColor = FluentTheme.Border,
            Font = FluentTheme.SubheadFont,
            CornerRadius = 23
        };
        btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
        pnlActions.Controls.Add(btnCancel);

        _btnLogin = new ModernButton
        {
            Text = "Masuk ke Sistem",
            ShortcutKey = "ENTER",
            Size = new Size(300, 46),
            Dock = DockStyle.Right,
            NormalBackColor = FluentTheme.Primary,
            HoverBackColor = FluentTheme.PrimaryDark,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont,
            CornerRadius = 23
        };
        _btnLogin.Click += async (s, e) => await PerformLoginAsync();
        pnlActions.Controls.Add(_btnLogin);

        _txtUsername.KeyDown += async (s, e) =>
        {
            if (e.KeyCode == Keys.Enter)
            {
                _txtPassword.Focus();
                _txtPassword.SelectAll();
            }
        };

        _txtPassword.KeyDown += async (s, e) =>
        {
            if (e.KeyCode == Keys.Enter)
            {
                await PerformLoginAsync();
            }
            else if (e.KeyCode == Keys.Escape)
            {
                DialogResult = DialogResult.Cancel;
                Close();
            }
        };
    }

    private async Task PerformLoginAsync()
    {
        string username = _txtUsername.Text.Trim();
        string password = _txtPassword.Text.Trim();

        if (string.IsNullOrEmpty(username))
        {
            _lblError.Text = "Harap masukkan username.";
            _txtUsername.Focus();
            return;
        }

        if (string.IsNullOrEmpty(password))
        {
            _lblError.Text = "Harap masukkan password/PIN.";
            _txtPassword.Focus();
            return;
        }

        _btnLogin.Enabled = false;
        _lblError.Text = "Memverifikasi kredensial...";
        _lblError.ForeColor = FluentTheme.TextSecondary;

        bool success = await _authService.LoginAsync(username, password);

        _btnLogin.Enabled = true;

        if (success)
        {
            DialogResult = DialogResult.OK;
            Close();
        }
        else
        {
            _lblError.Text = "Username atau Password/PIN salah. Harap periksa kembali.";
            _lblError.ForeColor = FluentTheme.Danger;
            _txtPassword.SelectAll();
            _txtPassword.Focus();
        }
    }
}
