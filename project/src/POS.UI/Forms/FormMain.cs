using System;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Application;
using POS.Domain;
using POS.Infrastructure;
using POS.License;
using POS.UI.Components;
using POS.UI.Theme;
using POS.UI.Views;

namespace POS.UI.Forms;

public class FormMain : Form
{
    private readonly SalesService _salesService;
    private readonly AuthService _authService;
    private readonly ShiftService _shiftService;
    private readonly LicenseManager _licenseManager;
    private readonly IProductRepository _productRepo;
    private readonly ICategoryRepository _categoryRepo;
    private readonly IStoreProfileRepository _storeRepo;
    private readonly ReportService _reportService;
    private readonly IShiftRepository _shiftRepo;
    private readonly DatabaseBackupService _backupService;
    private readonly IEmployeeRepository _employeeRepo;
    private readonly DatabaseContext _dbContext;

    // UI Controls
    private Panel _pnlHeader = null!;
    private Panel _pnlContent = null!;
    private StatusStrip _statusStrip = null!;
    private Label _lblLicensePill = null!;
    private Label _lblCashier = null!;
    private ModernButton _btnNavAdmin = null!;
    private ModernButton _btnNavPos = null!;
    private ModernButton _btnNavShift = null!;
    private ModernButton _btnNavProduct = null!;
    private ModernButton _btnNavReport = null!;
    private ModernButton _btnNavLicense = null!;
    private ModernButton _btnFullScreen = null!;
    private ModernButton _btnSwitchUser = null!;
    private ModernButton _btnUserMgmt = null!;
    private bool _isFullScreen = false;

    // Child Views
    private AdminDashboardView _adminDashboardView = null!;
    private PosTerminalView _posView = null!;
    private ShiftView _shiftView = null!;
    private ProductView _productView = null!;
    private ReportView _reportView = null!;
    private LicenseView _licenseView = null!;

    public FormMain(
        SalesService salesService,
        AuthService authService,
        ShiftService shiftService,
        LicenseManager licenseManager,
        IProductRepository productRepo,
        ICategoryRepository categoryRepo,
        IStoreProfileRepository storeRepo,
        ReportService reportService,
        IShiftRepository shiftRepo,
        DatabaseBackupService backupService,
        IEmployeeRepository employeeRepo,
        DatabaseContext dbContext)
    {
        _salesService = salesService;
        _authService = authService;
        _shiftService = shiftService;
        _licenseManager = licenseManager;
        _productRepo = productRepo;
        _categoryRepo = categoryRepo;
        _storeRepo = storeRepo;
        _reportService = reportService;
        _shiftRepo = shiftRepo;
        _backupService = backupService;
        _employeeRepo = employeeRepo;
        _dbContext = dbContext;

        InitializeComponent();
        _ = InitializeAppAsync();
    }

    private void InitializeComponent()
    {
        Text = "SparkPOS Native v1.0.4 — Toko Berkah Jaya (Cabang Utama)";
        Size = new Size(1280, 800);
        MinimumSize = new Size(1024, 700);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;
        KeyPreview = true;

        // Top App Header & Navigation Bar
        _pnlHeader = new Panel
        {
            Dock = DockStyle.Top,
            Height = 64,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(0)
        };
        Controls.Add(_pnlHeader);

        // 1. Left Brand & Logo Panel
        var leftBrandPanel = new Panel
        {
            Dock = DockStyle.Left,
            Width = 180,
            Padding = new Padding(16, 0, 0, 0)
        };
        _pnlHeader.Controls.Add(leftBrandPanel);

        var lblBrand = new Label
        {
            Text = "SPARK POS",
            Font = new Font("Segoe UI", 15f, FontStyle.Bold),
            ForeColor = FluentTheme.PrimaryDark,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft
        };
        leftBrandPanel.Controls.Add(lblBrand);

        // 2. Right Profile & Security Panel
        var rightProfilePanel = new FlowLayoutPanel
        {
            Dock = DockStyle.Right,
            AutoSize = true,
            WrapContents = false,
            FlowDirection = FlowDirection.RightToLeft,
            Padding = new Padding(0, 12, 16, 0)
        };
        _pnlHeader.Controls.Add(rightProfilePanel);

        var btnLock = new ModernButton
        {
            Text = "Kunci",
            Size = new Size(72, 38),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(6, 0, 0, 0)
        };
        btnLock.Click += (s, e) => LockTerminal();
        rightProfilePanel.Controls.Add(btnLock);

        _btnSwitchUser = new ModernButton
        {
            Text = "Ganti User",
            Size = new Size(95, 38),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(6, 0, 0, 0)
        };
        _btnSwitchUser.Click += (s, e) => SwitchUser();
        rightProfilePanel.Controls.Add(_btnSwitchUser);

        _btnUserMgmt = new ModernButton
        {
            Text = "Kelola Kasir",
            Size = new Size(110, 38),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            ShowBorder = false,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(6, 0, 0, 0),
            Visible = false
        };
        _btnUserMgmt.Click += (s, e) => OpenUserManagement();
        rightProfilePanel.Controls.Add(_btnUserMgmt);

        _btnFullScreen = new ModernButton
        {
            Text = "Layar Penuh",
            ShortcutKey = "F11",
            Size = new Size(125, 38),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(8, 0, 0, 0)
        };
        _btnFullScreen.Click += (s, e) => ToggleFullScreen();
        rightProfilePanel.Controls.Add(_btnFullScreen);

        _lblCashier = new Label
        {
            Text = "Siti Rahma (Kasir 01)\nShift Pagi",
            Font = FluentTheme.BodyBoldFont,
            ForeColor = FluentTheme.TextPrimary,
            TextAlign = ContentAlignment.MiddleRight,
            Size = new Size(160, 38),
            Margin = new Padding(8, 0, 0, 0)
        };
        rightProfilePanel.Controls.Add(_lblCashier);

        _lblLicensePill = new Label
        {
            Text = "Lisensi: Memeriksa...",
            Font = FluentTheme.BadgeFont,
            BackColor = FluentTheme.SurfaceHigh,
            ForeColor = FluentTheme.TextPrimary,
            TextAlign = ContentAlignment.MiddleCenter,
            Size = new Size(140, 32),
            Margin = new Padding(8, 3, 0, 0)
        };
        rightProfilePanel.Controls.Add(_lblLicensePill);

        // 3. Center Navigation Ribbon (Fills the remaining horizontal space)
        var centerNavPanel = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(12, 11, 12, 0)
        };
        _pnlHeader.Controls.Add(centerNavPanel);
        centerNavPanel.BringToFront();

        var navFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            WrapContents = false,
            AutoScroll = false
        };
        centerNavPanel.Controls.Add(navFlow);

        _btnNavAdmin = CreateNavButton("Panel Admin", "F5", false);
        _btnNavAdmin.Click += (s, e) => SwitchView(_adminDashboardView, _btnNavAdmin);
        navFlow.Controls.Add(_btnNavAdmin);

        _btnNavPos = CreateNavButton("Kasir", "F1", true);
        _btnNavPos.Click += (s, e) => SwitchView(_posView, _btnNavPos);
        navFlow.Controls.Add(_btnNavPos);

        _btnNavShift = CreateNavButton("Shift", "F2", false);
        _btnNavShift.Click += (s, e) => SwitchView(_shiftView, _btnNavShift);
        navFlow.Controls.Add(_btnNavShift);

        _btnNavProduct = CreateNavButton("Produk", "F3", false);
        _btnNavProduct.Click += (s, e) => SwitchView(_productView, _btnNavProduct);
        navFlow.Controls.Add(_btnNavProduct);

        _btnNavReport = CreateNavButton("Laporan", "F4", false);
        _btnNavReport.Click += (s, e) => SwitchView(_reportView, _btnNavReport);
        navFlow.Controls.Add(_btnNavReport);

        _btnNavLicense = CreateNavButton("Lisensi", "F9", false);
        _btnNavLicense.Click += (s, e) => SwitchView(_licenseView, _btnNavLicense);
        navFlow.Controls.Add(_btnNavLicense);

        // Center Content Container
        _pnlContent = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = FluentTheme.Background
        };
        Controls.Add(_pnlContent);

        // Bottom Status Strip
        _statusStrip = new StatusStrip
        {
            BackColor = FluentTheme.Surface,
            Font = FluentTheme.BadgeFont,
            Height = 28
        };
        Controls.Add(_statusStrip);

        _statusStrip.Items.Add(new ToolStripStatusLabel("Shortcut: [F1] Kasir  [F2] Shift  [F3] Produk  [F4] Laporan  [F5] Hold  [F6] Recall  [F7] Diskon  [F9] Lisensi  [F12] Bayar") { ForeColor = FluentTheme.TextSecondary });
        _statusStrip.Items.Add(new ToolStripStatusLabel { Spring = true });
        _statusStrip.Items.Add(new ToolStripStatusLabel("● SQLite Local: Siap") { ForeColor = FluentTheme.Secondary });
        _statusStrip.Items.Add(new ToolStripStatusLabel("● ESC/POS Printer: Ready") { ForeColor = FluentTheme.Secondary });
        _statusStrip.Items.Add(new ToolStripStatusLabel("● Cash Drawer: Ready") { ForeColor = FluentTheme.Secondary });

        KeyDown += FormMain_KeyDown;
    }

    private ModernButton CreateNavButton(string text, string shortcut, bool isActive)
    {
        return new ModernButton
        {
            Text = text,
            ShortcutKey = shortcut,
            Size = new Size(135, 40),
            NormalBackColor = isActive ? FluentTheme.Primary : FluentTheme.SurfaceHigh,
            NormalForeColor = isActive ? Color.White : FluentTheme.TextPrimary,
            ShowBorder = !isActive,
            Font = FluentTheme.SubheadFont,
            Margin = new Padding(0, 0, 8, 0)
        };
    }

    private async Task InitializeAppAsync()
    {
        // 1. Evaluate License
        var licResult = _licenseManager.EvaluateLicense();
        if (licResult.Status == LicenseStatus.Unregistered && !_licenseManager.HasUsedTrial)
        {
            var askTrial = MessageBox.Show(
                "Selamat datang di Spark POS!\n\n" +
                "Sistem terminal ini belum diaktivasi.\n" +
                "Apakah Anda ingin memulai Masa Percobaan (Trial 30 Hari) gratis sekarang?\n\n" +
                "(Anda juga dapat mengaktivasi lisensi resmi kapan saja melalui tab Lisensi).",
                "Masa Percobaan Spark POS",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);

            if (askTrial == DialogResult.Yes)
            {
                _licenseManager.StartTrial30Days();
                licResult = _licenseManager.EvaluateLicense();
            }
        }
        UpdateLicensePill(licResult);

        // 2. Instantiate Child Views
        _adminDashboardView = new AdminDashboardView(_storeRepo, _employeeRepo, _backupService, _dbContext, _productRepo);
        _adminDashboardView.OnStoreProfileUpdated += (profile) =>
        {
            Text = $"SparkPOS Native v1.1.0 — {profile.StoreName} ({profile.BranchName})";
        };

        _posView = new PosTerminalView(_salesService, _productRepo, _categoryRepo, _storeRepo, _authService, _shiftService);
        _posView.TransactionCompleted += async () =>
        {
            UpdateLicensePill(_licenseManager.EvaluateLicense());
            try
            {
                if (_shiftView != null) await _shiftView.RefreshShiftDataAsync();
                if (_productView != null) await _productView.FilterProductsAsync();
                if (_reportView != null) await _reportView.LoadReportDataAsync();
            }
            catch { }
        };

        _shiftView = new ShiftView(_shiftService, _authService, _shiftRepo);
        _shiftView.ShiftStatusChanged += () =>
        {
            if (_authService.CurrentEmployee != null)
            {
                ApplyUserRoleRestrictions();
            }
        };

        _productView = new ProductView(_productRepo, _categoryRepo);
        _reportView = new ReportView(_reportService);
        _licenseView = new LicenseView(_licenseManager, _backupService);
        _licenseView.LicenseUpdated += () => UpdateLicensePill(_licenseManager.EvaluateLicense());
        _licenseView.DatabaseRestored += async () =>
        {
            try
            {
                if (_adminDashboardView != null) await _adminDashboardView.LoadAllDataAsync();
                if (_posView != null) await _posView.RefreshAfterSwitchAsync();
                if (_shiftView != null) await _shiftView.RefreshShiftDataAsync();
                if (_productView != null) await _productView.FilterProductsAsync();
                if (_reportView != null) await _reportView.LoadReportDataAsync();
                UpdateLicensePill(_licenseManager.EvaluateLicense());
            }
            catch { }
        };

        // Load Store Profile for Window Title
        try
        {
            var initialProfile = await _storeRepo.GetProfileAsync();
            if (initialProfile != null)
            {
                Text = $"SparkPOS Native v1.1.0 — {initialProfile.StoreName} ({initialProfile.BranchName})";
            }
        }
        catch { }

        // 3. User Login Dialog on Startup (Default: Administrator / 123456 or kasir1 / 1111)
        bool loggedIn = await PromptLoginAsync(allowCancel: false);
        if (!loggedIn)
        {
            System.Windows.Forms.Application.Exit();
            return;
        }

        // When Administrator logs in: landing page is Admin Dashboard!
        // When Cashier logs in: landing page is POS Terminal View!
        if (_authService.CurrentEmployee?.Role == RoleType.Admin)
        {
            SwitchView(_adminDashboardView, _btnNavAdmin);
        }
        else
        {
            SwitchView(_posView, _btnNavPos);
        }
    }

    private async Task<bool> PromptLoginAsync(bool allowCancel)
    {
        using var loginForm = new FormLogin(_authService) { AllowExit = !allowCancel };
        var res = loginForm.ShowDialog(this);

        if (res == DialogResult.OK && _authService.CurrentEmployee != null)
        {
            ApplyUserRoleRestrictions();

            // Ensure active shift for logged-in user
            int empId = _authService.CurrentEmployee.Id;
            var shift = await _shiftService.LoadActiveShiftAsync(empId);
            if (shift == null && _authService.CurrentEmployee.Role == RoleType.Cashier)
            {
                await _shiftService.OpenShiftAsync(empId, _authService.CurrentEmployee.FullName, 100000);
            }

            return true;
        }

        return false;
    }

    private void ApplyUserRoleRestrictions()
    {
        var emp = _authService.CurrentEmployee;
        if (emp == null) return;

        string roleName = emp.Role switch
        {
            RoleType.Admin => "Administrator",
            RoleType.Supervisor => "Supervisor",
            _ => "Kasir"
        };

        _lblCashier.Text = $"{emp.FullName}\n{roleName}";
        _btnUserMgmt.Visible = (emp.Role == RoleType.Admin);
        _btnNavAdmin.Visible = (emp.Role == RoleType.Admin);

        if (emp.Role == RoleType.Cashier)
        {
            _btnNavProduct.NormalForeColor = FluentTheme.TextMuted;
            _btnNavReport.NormalForeColor = FluentTheme.TextMuted;
            _btnNavLicense.NormalForeColor = FluentTheme.TextMuted;
        }
        else
        {
            _btnNavProduct.NormalForeColor = FluentTheme.TextPrimary;
            _btnNavReport.NormalForeColor = FluentTheme.TextPrimary;
            _btnNavLicense.NormalForeColor = FluentTheme.TextPrimary;
        }
    }

    private async void SwitchUser()
    {
        bool ok = await PromptLoginAsync(allowCancel: true);
        if (ok)
        {
            if (_authService.CurrentEmployee?.Role == RoleType.Admin && _adminDashboardView != null)
            {
                SwitchView(_adminDashboardView, _btnNavAdmin);
            }
            else if (_posView != null)
            {
                SwitchView(_posView, _btnNavPos);
            }
        }
    }

    private void OpenUserManagement()
    {
        if (_authService.CurrentEmployee?.Role != RoleType.Admin)
        {
            MessageBox.Show("Hanya Administrator yang memiliki akses ke Manajemen Pengguna.", "Akses Ditolak", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        using var dlg = new FormUserManagement(_employeeRepo, _authService);
        dlg.ShowDialog(this);
        ApplyUserRoleRestrictions();
    }

    private async void SwitchView(UserControl view, ModernButton activeBtn)
    {
        // Enforce Role Restrictions
        if (view == _adminDashboardView && _authService.CurrentEmployee?.Role != RoleType.Admin)
        {
            MessageBox.Show("Panel Administrator hanya dapat diakses oleh Administrator.", "Akses Terbatas", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        else if (view == _productView && _authService.CurrentEmployee?.Role == RoleType.Cashier)
        {
            using var auth = new FormSupervisorAuth(_authService, "Otorisasi Diperlukan: Akses Master Produk");
            if (auth.ShowDialog(this) != DialogResult.OK) return;
        }
        else if (view == _reportView && _authService.CurrentEmployee?.Role == RoleType.Cashier)
        {
            using var auth = new FormSupervisorAuth(_authService, "Otorisasi Diperlukan: Akses Laporan Keuangan");
            if (auth.ShowDialog(this) != DialogResult.OK) return;
        }
        else if (view == _licenseView && _authService.CurrentEmployee?.Role != RoleType.Admin)
        {
            MessageBox.Show("Pengaturan lisensi hanya dapat diakses oleh Administrator.", "Akses Terbatas", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        _pnlContent.Controls.Clear();
        view.Dock = DockStyle.Fill;
        _pnlContent.Controls.Add(view);

        // Reset nav button states
        ModernButton[] allBtns = { _btnNavAdmin, _btnNavPos, _btnNavShift, _btnNavProduct, _btnNavReport, _btnNavLicense };
        foreach (var b in allBtns)
        {
            bool isCurrent = (b == activeBtn);
            b.NormalBackColor = isCurrent ? FluentTheme.Primary : FluentTheme.SurfaceHigh;
            b.NormalForeColor = isCurrent ? Color.White : FluentTheme.TextPrimary;
            b.ShowBorder = !isCurrent;
            b.Invalidate();
        }

        // Real-time data updates whenever switching view
        try
        {
            if (view == _adminDashboardView)
            {
                await _adminDashboardView.LoadAllDataAsync();
            }
            else if (view == _posView)
            {
                await _posView.RefreshAfterSwitchAsync();
                _posView.FocusBarcode();
            }
            else if (view == _shiftView)
            {
                await _shiftView.RefreshShiftDataAsync();
            }
            else if (view == _productView)
            {
                await _productView.FilterProductsAsync();
            }
            else if (view == _reportView)
            {
                await _reportView.LoadReportDataAsync();
            }
            else if (view == _licenseView)
            {
                _licenseView.RefreshDisplay();
            }
        }
        catch { }
    }

    private void UpdateLicensePill(LicenseValidationResult res)
    {
        switch (res.Status)
        {
            case LicenseStatus.Active:
                _lblLicensePill.Text = res.IsTrial ? $"Trial: {res.RemainingDays} Hari" : $"Lisensi Aktif ({res.RemainingDays} Hari)";
                _lblLicensePill.BackColor = FluentTheme.SecondaryContainer;
                _lblLicensePill.ForeColor = FluentTheme.Secondary;
                break;
            case LicenseStatus.GracePeriod:
                _lblLicensePill.Text = $"Grace: {res.RemainingGraceDays} Hari";
                _lblLicensePill.BackColor = FluentTheme.TertiaryContainer;
                _lblLicensePill.ForeColor = FluentTheme.Tertiary;
                break;
            case LicenseStatus.Expired:
                _lblLicensePill.Text = res.IsTrial ? "Trial Habis (Lockdown)" : "Lisensi Expired";
                _lblLicensePill.BackColor = ColorTranslator.FromHtml("#FFDAD6");
                _lblLicensePill.ForeColor = FluentTheme.Danger;
                break;
            case LicenseStatus.Tampered:
                _lblLicensePill.Text = "Jam Tampered (Lock)";
                _lblLicensePill.BackColor = ColorTranslator.FromHtml("#FFDAD6");
                _lblLicensePill.ForeColor = FluentTheme.Danger;
                break;
            default:
                _lblLicensePill.Text = "Belum Terdaftar";
                _lblLicensePill.BackColor = FluentTheme.SurfaceHigh;
                _lblLicensePill.ForeColor = FluentTheme.TextMuted;
                break;
        }
    }

    private void LockTerminal()
    {
        SwitchUser();
    }

    private void ToggleFullScreen()
    {
        _isFullScreen = !_isFullScreen;
        if (_isFullScreen)
        {
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Normal;
            WindowState = FormWindowState.Maximized;
            Bounds = Screen.FromControl(this).Bounds;
            _btnFullScreen.Text = "Keluar Full";
            _btnFullScreen.NormalBackColor = FluentTheme.Primary;
            _btnFullScreen.NormalForeColor = Color.White;
            _btnFullScreen.ShowBorder = false;
        }
        else
        {
            FormBorderStyle = FormBorderStyle.Sizable;
            WindowState = FormWindowState.Maximized;
            _btnFullScreen.Text = "Layar Penuh";
            _btnFullScreen.NormalBackColor = FluentTheme.SurfaceHigh;
            _btnFullScreen.NormalForeColor = FluentTheme.TextPrimary;
            _btnFullScreen.ShowBorder = true;
        }
        _btnFullScreen.Invalidate();
    }

    private async void FormMain_KeyDown(object? sender, KeyEventArgs e)
    {
        switch (e.KeyCode)
        {
            case Keys.F1:
                SwitchView(_posView, _btnNavPos);
                e.Handled = true;
                break;
            case Keys.F2:
                SwitchView(_shiftView, _btnNavShift);
                e.Handled = true;
                break;
            case Keys.F3:
                SwitchView(_productView, _btnNavProduct);
                e.Handled = true;
                break;
            case Keys.F4:
                SwitchView(_reportView, _btnNavReport);
                e.Handled = true;
                break;
            case Keys.F9:
                SwitchView(_licenseView, _btnNavLicense);
                e.Handled = true;
                break;
            case Keys.F11:
                ToggleFullScreen();
                e.Handled = true;
                break;
            case Keys.F5:
                if (_authService.CurrentEmployee?.Role == RoleType.Admin)
                {
                    SwitchView(_adminDashboardView, _btnNavAdmin);
                    e.Handled = true;
                }
                break;
            case Keys.F12:
                if (_pnlContent.Controls.Contains(_posView))
                {
                    await _posView.OpenPaymentModalAsync();
                    e.Handled = true;
                }
                break;
        }
    }
}
