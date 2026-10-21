using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using Dapper;
using POS.Domain;
using POS.Infrastructure;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Views;

public class AdminDashboardView : UserControl
{
    private readonly IStoreProfileRepository _storeRepo;
    private readonly IEmployeeRepository _employeeRepo;
    private readonly DatabaseBackupService _backupService;
    private readonly DatabaseContext _dbContext;
    private readonly IProductRepository _productRepo;

    // Store Profile Inputs
    private TextBox _txtStoreName = null!;
    private TextBox _txtBranchName = null!;
    private TextBox _txtPhone = null!;
    private TextBox _txtAddress = null!;
    private TextBox _txtReceiptHeader = null!;
    private TextBox _txtReceiptFooter = null!;
    private NumericUpDown _numTax = null!;
    private ModernButton _btnSaveStore = null!;
    private Label _lblStoreSavedStatus = null!;

    // Cashier Management Controls
    private DataGridView _gridEmployees = null!;
    private ModernButton _btnAddCashier = null!;
    private ModernButton _btnEditCashier = null!;
    private ModernButton _btnDeleteCashier = null!;
    private ModernButton _btnChangeAdminPass = null!;

    // Database Status Controls
    private Label _lblDbLocation = null!;
    private Label _lblDbSize = null!;
    private ModernButton _btnCleanFreshDb = null!;
    private ModernButton _btnSeedSampleProducts = null!;
    private ModernButton _btnBackupDb = null!;
    private ModernButton _btnOpenDbFolder = null!;

    public event Action<StoreProfile>? OnStoreProfileUpdated;

    public AdminDashboardView(
        IStoreProfileRepository storeRepo,
        IEmployeeRepository employeeRepo,
        DatabaseBackupService backupService,
        DatabaseContext dbContext,
        IProductRepository productRepo)
    {
        _storeRepo = storeRepo;
        _employeeRepo = employeeRepo;
        _backupService = backupService;
        _dbContext = dbContext;
        _productRepo = productRepo;

        InitializeComponent();
        _ = LoadAllDataAsync();
    }

    private void InitializeComponent()
    {
        Dock = DockStyle.Fill;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;

        var outerContainer = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            Padding = new Padding(16)
        };
        Controls.Add(outerContainer);

        // ================= TOP HEADER RIBBON =================
        var headerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 60,
            Padding = new Padding(4, 0, 4, 10)
        };
        outerContainer.Controls.Add(headerPanel);

        var lblTitle = new Label
        {
            Text = "PANEL ADMINISTRATOR TOKO",
            Font = new Font("Segoe UI", 15f, FontStyle.Bold),
            ForeColor = FluentTheme.PrimaryDark,
            Dock = DockStyle.Top,
            Height = 28
        };
        headerPanel.Controls.Add(lblTitle);

        var lblSub = new Label
        {
            Text = "Pusat kendali profil toko, identitas struk nota, manajemen kasir, dan pemeliharaan database",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Top,
            Height = 22
        };
        headerPanel.Controls.Add(lblSub);

        // ================= MAIN VERTICAL STACK =================
        var contentStack = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            Width = 1100,
            Padding = new Padding(0)
        };
        outerContainer.Controls.Add(contentStack);
        contentStack.BringToFront();

        // ----------------- CARD 1: PROFIL & IDENTITAS TOKO -----------------
        var cardStore = CreateSectionCard("Identitas & Profil Toko (Tampil di Nota Struk & Aplikasi)", 380);
        contentStack.Controls.Add(cardStore);

        var storeGrid = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 5,
            Padding = new Padding(8, 4, 8, 4)
        };
        storeGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        storeGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        cardStore.Controls.Add(storeGrid);
        storeGrid.BringToFront();

        // Row 0: Nama Toko & Nama Cabang
        var pnlName = CreateFormField("Nama Toko / Outlet:", out _txtStoreName, "Contoh: Toko Berkah Jaya");
        storeGrid.Controls.Add(pnlName, 0, 0);

        var pnlBranch = CreateFormField("Nama Cabang:", out _txtBranchName, "Contoh: Cabang Utama / Sudirman");
        storeGrid.Controls.Add(pnlBranch, 1, 0);

        // Row 1: No Telp/WA & Tarif Pajak
        var pnlPhone = CreateFormField("No. Telepon / WhatsApp Toko:", out _txtPhone, "Contoh: 0812-3456-7890 / 021-5551234");
        storeGrid.Controls.Add(pnlPhone, 0, 1);

        var pnlTax = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 2, 8, 4) };
        pnlTax.Controls.Add(new Label { Text = "Tarif PPN (%):", Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.TextPrimary, Dock = DockStyle.Top, Height = 20 });
        _numTax = new NumericUpDown
        {
            Dock = DockStyle.Top,
            Font = new Font("Segoe UI", 11f),
            Minimum = 0,
            Maximum = 100,
            DecimalPlaces = 1,
            Value = 11,
            Height = 30
        };
        pnlTax.Controls.Add(_numTax);
        storeGrid.Controls.Add(pnlTax, 1, 1);

        // Row 2: Alamat Lengkap & Catatan Header Struk
        var pnlAddr = CreateFormMultilineField("Alamat Lengkap Toko:", out _txtAddress, "Contoh: Jl. Sudirman No. 45, Jakarta Pusat", 60);
        storeGrid.Controls.Add(pnlAddr, 0, 2);

        var pnlHeader = CreateFormMultilineField("Catatan Header Struk (Teks Pembuka):", out _txtReceiptHeader, "Selamat Datang di Toko Berkah\nBelanja Hemat Setiap Hari", 60);
        storeGrid.Controls.Add(pnlHeader, 1, 2);

        // Row 3: Catatan Footer Struk (Full Span or Right)
        var pnlFooter = CreateFormMultilineField("Catatan Footer Struk (Ucapan Terima Kasih):", out _txtReceiptFooter, "Terima Kasih Atas Kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.", 60);
        storeGrid.Controls.Add(pnlFooter, 0, 3);
        storeGrid.SetColumnSpan(pnlFooter, 2);

        // Row 4: Action Bar Simpan
        var pnlStoreActions = new Panel { Dock = DockStyle.Fill, Height = 46, Padding = new Padding(0, 4, 0, 0) };
        _btnSaveStore = new ModernButton
        {
            Text = "Simpan Profil Toko",
            Size = new Size(200, 38),
            Dock = DockStyle.Left,
            NormalBackColor = FluentTheme.Secondary,
            HoverBackColor = FluentTheme.SecondaryHover,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont
        };
        _btnSaveStore.Click += async (s, e) => await SaveStoreProfileAsync();
        pnlStoreActions.Controls.Add(_btnSaveStore);

        _lblStoreSavedStatus = new Label
        {
            Text = "",
            Font = FluentTheme.BodyBoldFont,
            ForeColor = FluentTheme.Secondary,
            Dock = DockStyle.Left,
            AutoSize = true,
            TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(12, 10, 0, 0)
        };
        pnlStoreActions.Controls.Add(_lblStoreSavedStatus);

        storeGrid.Controls.Add(pnlStoreActions, 0, 4);
        storeGrid.SetColumnSpan(pnlStoreActions, 2);

        // ----------------- CARD 2: MANAJEMEN AKUN KASIR & PEGAWAI -----------------
        var cardEmployees = CreateSectionCard("Manajemen Akun Kasir & Pegawai", 320);
        contentStack.Controls.Add(cardEmployees);

        var empActionRibbon = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 44,
            WrapContents = false,
            Padding = new Padding(4, 2, 4, 6)
        };
        cardEmployees.Controls.Add(empActionRibbon);

        _btnAddCashier = new ModernButton
        {
            Text = "+ Tambah Kasir Baru",
            Size = new Size(160, 34),
            NormalBackColor = FluentTheme.Primary,
            HoverBackColor = FluentTheme.PrimaryHover,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 8, 0)
        };
        _btnAddCashier.Click += async (s, e) => await ShowAddCashierModalAsync();
        empActionRibbon.Controls.Add(_btnAddCashier);

        _btnEditCashier = new ModernButton
        {
            Text = "Edit / Ganti PIN",
            Size = new Size(140, 34),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 8, 0)
        };
        _btnEditCashier.Click += async (s, e) => await EditSelectedEmployeeAsync();
        empActionRibbon.Controls.Add(_btnEditCashier);

        _btnDeleteCashier = new ModernButton
        {
            Text = "Hapus Kasir",
            Size = new Size(120, 34),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.Danger,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 8, 0)
        };
        _btnDeleteCashier.Click += async (s, e) => await DeleteSelectedEmployeeAsync();
        empActionRibbon.Controls.Add(_btnDeleteCashier);

        _btnChangeAdminPass = new ModernButton
        {
            Text = "Ganti Password Administrator",
            Size = new Size(210, 34),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.PrimaryDark,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 8, 0)
        };
        _btnChangeAdminPass.Click += async (s, e) => await ChangeAdminPasswordModalAsync();
        empActionRibbon.Controls.Add(_btnChangeAdminPass);

        // DataGridView for Employees
        _gridEmployees = new DataGridView
        {
            Dock = DockStyle.Fill,
            RowTemplate = { Height = 38 }
        };
        FluentTheme.ApplyModernGridStyle(_gridEmployees);

        _gridEmployees.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColId", HeaderText = "ID", Width = 50 });
        _gridEmployees.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColUsername", HeaderText = "Username Login", Width = 150 });
        _gridEmployees.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColFullName", HeaderText = "Nama Lengkap", FillWeight = 40, AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
        _gridEmployees.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColRole", HeaderText = "Hak Akses (Role)", Width = 150 });
        _gridEmployees.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColStatus", HeaderText = "Status", Width = 90, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter } });

        cardEmployees.Controls.Add(_gridEmployees);
        _gridEmployees.BringToFront();

        // ----------------- CARD 3: PEMELIHARAAN DATABASE & MULAI FRESH -----------------
        var cardDb = CreateSectionCard("Pemeliharaan Database & Status Toko Bersih (Fresh)", 175);
        contentStack.Controls.Add(cardDb);

        var pnlDbInfo = new Panel
        {
            Dock = DockStyle.Top,
            Height = 44,
            Padding = new Padding(8, 2, 8, 2)
        };
        cardDb.Controls.Add(pnlDbInfo);

        _lblDbLocation = new Label
        {
            Text = "Lokasi Database: Memuat...",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Top,
            Height = 20
        };
        pnlDbInfo.Controls.Add(_lblDbLocation);

        _lblDbSize = new Label
        {
            Text = "Ukuran Database: 0 KB",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 20
        };
        pnlDbInfo.Controls.Add(_lblDbSize);

        var pnlDbActions = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 46,
            WrapContents = false,
            Padding = new Padding(4, 4, 4, 4)
        };
        cardDb.Controls.Add(pnlDbActions);
        pnlDbActions.BringToFront();

        _btnCleanFreshDb = new ModernButton
        {
            Text = "Bersihkan Transaksi (Mulai Toko Fresh)",
            Size = new Size(260, 36),
            NormalBackColor = FluentTheme.Danger,
            HoverBackColor = FluentTheme.DangerHover,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 10, 0)
        };
        _btnCleanFreshDb.Click += async (s, e) => await CleanFreshDatabaseAsync();
        pnlDbActions.Controls.Add(_btnCleanFreshDb);

        _btnSeedSampleProducts = new ModernButton
        {
            Text = "Muat Contoh Produk Ritel (10 Item)",
            Size = new Size(230, 36),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.PrimaryDark,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 10, 0)
        };
        _btnSeedSampleProducts.Click += async (s, e) => await SeedSampleProductsAsync();
        pnlDbActions.Controls.Add(_btnSeedSampleProducts);

        _btnBackupDb = new ModernButton
        {
            Text = "Ekspor / Backup Database (.db)",
            Size = new Size(210, 36),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 10, 0)
        };
        _btnBackupDb.Click += (s, e) => BackupDatabase();
        pnlDbActions.Controls.Add(_btnBackupDb);

        _btnOpenDbFolder = new ModernButton
        {
            Text = "Buka Folder Data",
            Size = new Size(140, 36),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont
        };
        _btnOpenDbFolder.Click += (s, e) => OpenDataFolder();
        pnlDbActions.Controls.Add(_btnOpenDbFolder);
    }

    private ModernPanel CreateSectionCard(string title, int height)
    {
        var card = new ModernPanel
        {
            Width = 1080,
            Height = height,
            BackColor = FluentTheme.Surface,
            BorderColor = FluentTheme.Border,
            CornerRadius = 18,
            Padding = new Padding(18, 16, 18, 16),
            Margin = new Padding(0, 0, 0, 16)
        };

        var lblCardTitle = new Label
        {
            Text = title,
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 28
        };
        card.Controls.Add(lblCardTitle);

        return card;
    }

    private Panel CreateFormField(string labelText, out TextBox txtBox, string placeholder)
    {
        var pnl = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 2, 8, 4) };
        pnl.Controls.Add(new Label { Text = labelText, Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.TextPrimary, Dock = DockStyle.Top, Height = 20 });
        txtBox = new TextBox
        {
            Dock = DockStyle.Top,
            Font = new Font("Segoe UI", 11f),
            PlaceholderText = placeholder,
            Height = 30
        };
        pnl.Controls.Add(txtBox);
        return pnl;
    }

    private Panel CreateFormMultilineField(string labelText, out TextBox txtBox, string placeholder, int height)
    {
        var pnl = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 2, 8, 4) };
        pnl.Controls.Add(new Label { Text = labelText, Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.TextPrimary, Dock = DockStyle.Top, Height = 20 });
        txtBox = new TextBox
        {
            Dock = DockStyle.Top,
            Font = new Font("Segoe UI", 10.5f),
            Multiline = true,
            ScrollBars = ScrollBars.Vertical,
            Height = height,
            PlaceholderText = placeholder
        };
        pnl.Controls.Add(txtBox);
        return pnl;
    }

    public async Task LoadAllDataAsync()
    {
        await LoadStoreProfileAsync();
        await LoadEmployeesAsync();
        RefreshDbInfo();
    }

    private async Task LoadStoreProfileAsync()
    {
        var profile = await _storeRepo.GetProfileAsync();
        if (profile != null)
        {
            _txtStoreName.Text = profile.StoreName;
            _txtBranchName.Text = profile.BranchName;
            _txtPhone.Text = profile.Phone;
            _txtAddress.Text = profile.Address;
            _txtReceiptHeader.Text = profile.ReceiptHeader;
            _txtReceiptFooter.Text = profile.ReceiptFooter;
            _numTax.Value = Math.Max(0, Math.Min(100, profile.TaxPercentage));
        }
    }

    private async Task SaveStoreProfileAsync()
    {
        string storeName = _txtStoreName.Text.Trim();
        if (string.IsNullOrWhiteSpace(storeName))
        {
            MessageBox.Show("Nama Toko tidak boleh kosong.", "Validasi", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _txtStoreName.Focus();
            return;
        }

        var profile = new StoreProfile
        {
            StoreName = storeName,
            BranchName = _txtBranchName.Text.Trim(),
            Phone = _txtPhone.Text.Trim(),
            Address = _txtAddress.Text.Trim(),
            ReceiptHeader = _txtReceiptHeader.Text.Trim(),
            ReceiptFooter = _txtFooterClean(_txtReceiptFooter.Text.Trim()),
            TaxPercentage = _numTax.Value,
            DefaultTaxInclusive = false
        };

        bool ok = await _storeRepo.UpdateProfileAsync(profile);
        if (ok)
        {
            _lblStoreSavedStatus.Text = "✓ Profil toko dan struk berhasil disimpan!";
            _lblStoreSavedStatus.ForeColor = FluentTheme.Secondary;
            OnStoreProfileUpdated?.Invoke(profile);

            _ = Task.Delay(3500).ContinueWith(_ =>
            {
                if (!IsDisposed && IsHandleCreated)
                {
                    Invoke(() => _lblStoreSavedStatus.Text = "");
                }
            });
        }
        else
        {
            MessageBox.Show("Gagal menyimpan profil toko ke database.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static string _txtFooterClean(string raw)
    {
        return raw.Replace("\r\n", "\n").Replace("\\n", "\n");
    }

    private async Task LoadEmployeesAsync()
    {
        _gridEmployees.Rows.Clear();
        var employees = await _employeeRepo.GetAllAsync();

        foreach (var emp in employees)
        {
            string roleLabel = emp.Role switch
            {
                RoleType.Admin => "Administrator (Akses Penuh)",
                RoleType.Supervisor => "Supervisor",
                _ => "Kasir Terminal"
            };

            string statusLabel = emp.IsActive ? "Aktif" : "Nonaktif";
            int rowIdx = _gridEmployees.Rows.Add(emp.Id, emp.Username, emp.FullName, roleLabel, statusLabel);
            _gridEmployees.Rows[rowIdx].Tag = emp;

            if (!emp.IsActive)
            {
                _gridEmployees.Rows[rowIdx].DefaultCellStyle.ForeColor = FluentTheme.TextMuted;
            }
        }
    }

    private async Task ShowAddCashierModalAsync()
    {
        using var modal = new Form
        {
            Text = "Tambah Kasir Baru — Spark POS",
            Size = new Size(420, 360),
            StartPosition = FormStartPosition.CenterParent,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            BackColor = FluentTheme.Background,
            Font = FluentTheme.BodyFont
        };

        var pnl = new ModernPanel { Dock = DockStyle.Fill, Padding = new Padding(20) };
        modal.Controls.Add(pnl);

        pnl.Controls.Add(new Label { Text = "TAMBAH AKUN KASIR BARU", Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.PrimaryDark, Dock = DockStyle.Top, Height = 28 });

        var txtUser = new TextBox { Dock = DockStyle.Top, Font = new Font("Segoe UI", 11f), PlaceholderText = "Username (contoh: kasir2)" };
        pnl.Controls.Add(txtUser);
        pnl.Controls.Add(new Label { Text = "Username Kasir:", Font = FluentTheme.BodyBoldFont, Dock = DockStyle.Top, Height = 24 });

        var txtName = new TextBox { Dock = DockStyle.Top, Font = new Font("Segoe UI", 11f), PlaceholderText = "Nama Lengkap Kasir (contoh: Siti Nurhaliza)" };
        pnl.Controls.Add(txtName);
        pnl.Controls.Add(new Label { Text = "Nama Lengkap:", Font = FluentTheme.BodyBoldFont, Dock = DockStyle.Top, Height = 24 });

        var txtPin = new TextBox { Dock = DockStyle.Top, Font = new Font("Segoe UI", 11f), PasswordChar = '●', PlaceholderText = "PIN Kasir 4-6 Angka (contoh: 2222)" };
        pnl.Controls.Add(txtPin);
        pnl.Controls.Add(new Label { Text = "PIN Akses Masuk:", Font = FluentTheme.BodyBoldFont, Dock = DockStyle.Top, Height = 24 });

        var btnSubmit = new ModernButton
        {
            Text = "Tambah Kasir",
            Dock = DockStyle.Bottom,
            Height = 40,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White
        };
        pnl.Controls.Add(btnSubmit);

        btnSubmit.Click += async (s, e) =>
        {
            string u = txtUser.Text.Trim();
            string n = txtName.Text.Trim();
            string p = txtPin.Text.Trim();

            if (string.IsNullOrWhiteSpace(u) || string.IsNullOrWhiteSpace(p))
            {
                MessageBox.Show("Username dan PIN tidak boleh kosong.", "Validasi", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            var emp = new Employee
            {
                Username = u,
                FullName = string.IsNullOrWhiteSpace(n) ? u : n,
                Pin = p,
                Role = RoleType.Cashier,
                IsActive = true,
                CreatedAt = DateTime.Now
            };

            int id = await _employeeRepo.CreateAsync(emp);
            if (id > 0)
            {
                MessageBox.Show($"Akun kasir '{u}' berhasil dibuat dengan PIN '{p}'.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
                modal.DialogResult = DialogResult.OK;
                modal.Close();
            }
            else
            {
                MessageBox.Show("Gagal membuat akun kasir.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        };

        if (modal.ShowDialog() == DialogResult.OK)
        {
            await LoadEmployeesAsync();
        }
    }

    private async Task EditSelectedEmployeeAsync()
    {
        if (_gridEmployees.SelectedRows.Count == 0)
        {
            MessageBox.Show("Pilih kasir yang ingin diedit dari tabel terlebih dahulu.", "Pilih Baris", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        var emp = _gridEmployees.SelectedRows[0].Tag as Employee;
        if (emp == null) return;

        using var modal = new Form
        {
            Text = $"Edit Akun: {emp.Username} — Spark POS",
            Size = new Size(420, 380),
            StartPosition = FormStartPosition.CenterParent,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            BackColor = FluentTheme.Background,
            Font = FluentTheme.BodyFont
        };

        var pnl = new ModernPanel { Dock = DockStyle.Fill, Padding = new Padding(20) };
        modal.Controls.Add(pnl);

        pnl.Controls.Add(new Label { Text = $"EDIT AKUN: {emp.Username.ToUpper()}", Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.PrimaryDark, Dock = DockStyle.Top, Height = 28 });

        var txtName = new TextBox { Dock = DockStyle.Top, Font = new Font("Segoe UI", 11f), Text = emp.FullName };
        pnl.Controls.Add(txtName);
        pnl.Controls.Add(new Label { Text = "Nama Lengkap:", Font = FluentTheme.BodyBoldFont, Dock = DockStyle.Top, Height = 24 });

        var txtPin = new TextBox { Dock = DockStyle.Top, Font = new Font("Segoe UI", 11f), Text = emp.Pin };
        pnl.Controls.Add(txtPin);
        pnl.Controls.Add(new Label { Text = "Password / PIN Baru:", Font = FluentTheme.BodyBoldFont, Dock = DockStyle.Top, Height = 24 });

        var chkActive = new CheckBox { Text = "Akun Aktif (Dapat Login)", Checked = emp.IsActive, Dock = DockStyle.Top, Height = 30, Font = FluentTheme.BodyBoldFont };
        pnl.Controls.Add(chkActive);

        var btnSubmit = new ModernButton
        {
            Text = "Simpan Perubahan",
            Dock = DockStyle.Bottom,
            Height = 40,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White
        };
        pnl.Controls.Add(btnSubmit);

        btnSubmit.Click += async (s, e) =>
        {
            string n = txtName.Text.Trim();
            string p = txtPin.Text.Trim();

            if (string.IsNullOrWhiteSpace(p))
            {
                MessageBox.Show("Password/PIN tidak boleh kosong.", "Validasi", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            emp.FullName = string.IsNullOrWhiteSpace(n) ? emp.Username : n;
            emp.Pin = p;
            emp.IsActive = chkActive.Checked;

            bool ok = await _employeeRepo.UpdateAsync(emp);
            if (ok)
            {
                MessageBox.Show($"Akun '{emp.Username}' berhasil diperbarui.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
                modal.DialogResult = DialogResult.OK;
                modal.Close();
            }
        };

        if (modal.ShowDialog() == DialogResult.OK)
        {
            await LoadEmployeesAsync();
        }
    }

    private async Task DeleteSelectedEmployeeAsync()
    {
        if (_gridEmployees.SelectedRows.Count == 0)
        {
            MessageBox.Show("Pilih kasir yang ingin dihapus dari tabel.", "Pilih Baris", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        var emp = _gridEmployees.SelectedRows[0].Tag as Employee;
        if (emp == null) return;

        if (emp.Role == RoleType.Admin)
        {
            MessageBox.Show("Akun Administrator Utama tidak dapat dihapus.", "Akses Ditolak", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var confirm = MessageBox.Show(
            $"Apakah Anda yakin ingin menghapus akun kasir '{emp.Username}' ({emp.FullName})?\n\nKasir ini tidak akan dapat login lagi ke sistem.",
            "Konfirmasi Hapus Akun",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning);

        if (confirm == DialogResult.Yes)
        {
            using var conn = _dbContext.CreateConnection();
            await conn.ExecuteAsync("DELETE FROM Employees WHERE Id = @Id", new { emp.Id });
            MessageBox.Show($"Akun kasir '{emp.Username}' telah dihapus.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
            await LoadEmployeesAsync();
        }
    }

    private async Task ChangeAdminPasswordModalAsync()
    {
        using var modal = new Form
        {
            Text = "Ubah Password Administrator — Spark POS",
            Size = new Size(400, 260),
            StartPosition = FormStartPosition.CenterParent,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            BackColor = FluentTheme.Background,
            Font = FluentTheme.BodyFont
        };

        var pnl = new ModernPanel { Dock = DockStyle.Fill, Padding = new Padding(20) };
        modal.Controls.Add(pnl);

        pnl.Controls.Add(new Label { Text = "GANTI PASSWORD ADMINISTRATOR", Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.PrimaryDark, Dock = DockStyle.Top, Height = 28 });

        var txtNewPass = new TextBox { Dock = DockStyle.Top, Font = new Font("Segoe UI", 12f), PasswordChar = '●', PlaceholderText = "Masukkan password baru" };
        pnl.Controls.Add(txtNewPass);
        pnl.Controls.Add(new Label { Text = "Password Baru Administrator:", Font = FluentTheme.BodyBoldFont, Dock = DockStyle.Top, Height = 24 });

        var btnSubmit = new ModernButton
        {
            Text = "Simpan Password Baru",
            Dock = DockStyle.Bottom,
            Height = 40,
            NormalBackColor = FluentTheme.Secondary,
            NormalForeColor = Color.White
        };
        pnl.Controls.Add(btnSubmit);

        btnSubmit.Click += async (s, e) =>
        {
            string newP = txtNewPass.Text.Trim();
            if (string.IsNullOrWhiteSpace(newP))
            {
                MessageBox.Show("Password tidak boleh kosong.", "Validasi", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            using var conn = _dbContext.CreateConnection();
            await conn.ExecuteAsync("UPDATE Employees SET Pin = @Pin WHERE LOWER(Username) = 'administrator'", new { Pin = newP });
            MessageBox.Show("Password Administrator berhasil diubah! Kredensial baru sekarang aktif.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
            modal.DialogResult = DialogResult.OK;
            modal.Close();
        };

        modal.ShowDialog();
    }

    private void RefreshDbInfo()
    {
        _lblDbLocation.Text = $"Lokasi Database: {_backupService.GetDatabasePath()}";
        _lblDbSize.Text = $"Ukuran Database Saat Ini: {_backupService.GetDatabaseSizeFormatted()}";
    }

    private async Task CleanFreshDatabaseAsync()
    {
        var confirm = MessageBox.Show(
            "PEMBERSIHAN DATABASE (MULAI TOKO FRESH & BERSIH):\n\n" +
            "Tindakan ini akan mengosongkan seluruh riwayat transaksi penjualan, shift kasir, pergerakan stok, dan data pengujian agar database 100% FRESH.\n\n" +
            "Akun Administrator dan Profil Toko Anda akan tetap dipertahankan.\n\n" +
            "Apakah Anda ingin melanjutkan pembersihan?",
            "Konfirmasi Pembersihan Database (Mulai Toko Fresh)",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning);

        if (confirm != DialogResult.Yes) return;

        try
        {
            using var conn = _dbContext.CreateConnection();
            using var tran = conn.BeginTransaction();

            await conn.ExecuteAsync("DELETE FROM TransactionDetails;", transaction: tran);
            await conn.ExecuteAsync("DELETE FROM Payments;", transaction: tran);
            await conn.ExecuteAsync("DELETE FROM Transactions;", transaction: tran);
            await conn.ExecuteAsync("DELETE FROM Shifts;", transaction: tran);
            await conn.ExecuteAsync("DELETE FROM StockMovements;", transaction: tran);
            await conn.ExecuteAsync("DELETE FROM Customers;", transaction: tran);
            await conn.ExecuteAsync("DELETE FROM Products;", transaction: tran);

            tran.Commit();

            // Run VACUUM outside transaction to shrink SQLite file
            await conn.ExecuteAsync("VACUUM;");

            RefreshDbInfo();

            MessageBox.Show(
                "SUKSES!\n\nSeluruh data pengujian, riwayat transaksi, produk, dan member telah dibersihkan.\nDatabase saat ini 100% FRESH & BERSIH (0 Produk, 0 Member, 0 Transaksi) siap untuk dipakai berjualan!",
                "Database 100% Bersih (Fresh)",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Gagal membersihkan database: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task SeedSampleProductsAsync()
    {
        var confirm = MessageBox.Show(
            "Apakah Anda ingin memuat 10 contoh produk ritel FMCG (Minyak Sania, Indomie, Aqua, Teh Botol, Chitato, dll.) ke dalam katalog?",
            "Muat Contoh Produk Ritel",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);

        if (confirm != DialogResult.Yes) return;

        using var conn = _dbContext.CreateConnection();
        await conn.ExecuteAsync(@"
            INSERT OR IGNORE INTO Categories (Id, Name, Description) VALUES
            (1, 'Sembako & Minyak', 'Beras, minyak goreng, gula, tepung'),
            (2, 'Minuman Dingin', 'Air mineral, teh kemasan, kopi, jus'),
            (3, 'Makanan Ringan', 'Keripik, biskuit, snack coklat'),
            (4, 'Mie Instan & Bumbu', 'Mie instan berbagai rasa, bumbu masak');

            INSERT OR IGNORE INTO Products (Sku, Barcode, Name, CategoryId, UnitId, BuyPrice, SellPrice, Stock, MinStock, ImagePath, IsActive) VALUES
            ('SKU-MYK-001', '8992753210014', 'Minyak Goreng Sania 2L', 1, 1, 31000, 36500, 48, 10, 'sania_2l.png', 1),
            ('SKU-MIE-001', '089686010924', 'Indomie Goreng Spesial 85g', 4, 1, 2800, 3500, 120, 24, 'indomie_goreng.png', 1),
            ('SKU-MIE-002', '089686010931', 'Indomie Kuah Ayam Bawang 69g', 4, 1, 2700, 3300, 95, 24, 'indomie_kuah.png', 1),
            ('SKU-MNM-001', '8999999014383', 'Aqua Air Mineral 600ml', 2, 1, 2900, 4000, 85, 15, 'aqua_600ml.png', 1),
            ('SKU-MNM-002', '8999999510106', 'Teh Botol Sosro Kotak 250ml', 2, 1, 3200, 4500, 60, 12, 'tehbotol_250ml.png', 1),
            ('SKU-MNM-003', '8992753112004', 'Kopi Kapal Api Spesial Mix 10s', 2, 3, 11500, 14000, 40, 8, 'kapalapi_mix.png', 1),
            ('SKU-SNK-001', '8996001301018', 'Chitato Sapi Panggang 68g', 3, 1, 8800, 11500, 35, 10, 'chitato_68g.png', 1),
            ('SKU-SNK-002', '8996001410215', 'Oreo Vanilla Roll 133g', 3, 1, 7900, 10000, 28, 8, 'oreo_133g.png', 1),
            ('SKU-BRS-001', '8991001001123', 'Beras Ramos Super 5kg', 1, 1, 68000, 76000, 20, 5, 'beras_5kg.png', 1),
            ('SKU-GLA-001', '8991002002130', 'Gulaku Premium Putih 1kg', 1, 1, 15500, 18500, 50, 10, 'gulaku_1kg.png', 1);
        ");

        MessageBox.Show("10 Contoh Produk Ritel FMCG berhasil dimuat ke dalam katalog!", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
        RefreshDbInfo();
    }

    private async void BackupDatabase()
    {
        using var sfd = new SaveFileDialog
        {
            Filter = "SQLite Database (*.db)|*.db",
            FileName = $"SparkPOS_Backup_{DateTime.Now:yyyyMMdd_HHmmss}.db",
            Title = "Ekspor Cadangan Database Spark POS"
        };

        if (sfd.ShowDialog() == DialogResult.OK)
        {
            try
            {
                long bytes = await _backupService.ExportBackupAsync(sfd.FileName);
                if (bytes > 0)
                {
                    MessageBox.Show($"Database berhasil dicadangkan ke:\n{sfd.FileName}\nUkuran: {bytes / 1024.0:F1} KB", "Backup Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Gagal mencadangkan database: {ex.Message}", "Backup Gagal", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    private void OpenDataFolder()
    {
        string dir = Path.GetDirectoryName(_backupService.GetDatabasePath()) ?? "";
        if (Directory.Exists(dir))
        {
            Process.Start(new ProcessStartInfo { FileName = dir, UseShellExecute = true });
        }
    }
}
