using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Domain;
using POS.Infrastructure;
using POS.License;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Views;

public class LicenseView : UserControl
{
    private readonly LicenseManager _licenseManager;
    private readonly DatabaseBackupService? _backupService;

    private Label _lblStatusTitle = null!;
    private Label _lblStatusSub = null!;
    private Label _lblRemainingDays = null!;
    private Label _lblFingerprint = null!;
    private TextBox _txtSerialKey = null!;
    private Panel _pnlStatusBadge = null!;
    private ModernButton _btnTrial = null!;

    // Backup & Restore Controls
    private Label _lblDbPath = null!;
    private Label _lblDbSize = null!;

    public event Action? LicenseUpdated;
    public event Action? DatabaseRestored;

    public LicenseView(LicenseManager licenseManager, DatabaseBackupService? backupService = null)
    {
        _licenseManager = licenseManager;
        _backupService = backupService;
        InitializeComponent();
        RefreshDisplay();
    }

    private void InitializeComponent()
    {
        Dock = DockStyle.Fill;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;

        var scrollContainer = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            Padding = new Padding(20)
        };
        Controls.Add(scrollContainer);

        // Header Title Panel (Responsive FlowLayout, zero text overlap)
        var pnlHeader = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            Padding = new Padding(0, 0, 0, 14),
            Margin = new Padding(0)
        };
        scrollContainer.Controls.Add(pnlHeader);

        var lblPageTitle = new Label
        {
            Text = "Lisensi & Pengaturan Sistem (§8.9 PRD)",
            Font = FluentTheme.HeadlineLgFont,
            ForeColor = FluentTheme.TextPrimary,
            AutoSize = true,
            Margin = new Padding(0, 0, 0, 6)
        };
        pnlHeader.Controls.Add(lblPageTitle);

        var lblPageSub = new Label
        {
            Text = "Manajemen lisensi sewa bulanan offline-first, proteksi kriptografi, serta pencadangan & pemulihan database.",
            Font = FluentTheme.BodyFont,
            ForeColor = FluentTheme.TextSecondary,
            AutoSize = true,
            Margin = new Padding(0)
        };
        pnlHeader.Controls.Add(lblPageSub);

        // ================= 1. HERO STATUS CARD =================
        var heroCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 160,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(20),
            Margin = new Padding(0, 0, 0, 12)
        };
        scrollContainer.Controls.Add(heroCard);

        // Right side: Remaining Days Metric Dial
        var metricBox = new ModernPanel
        {
            Dock = DockStyle.Right,
            Width = 190,
            BackColor = FluentTheme.SurfaceLow,
            ShowBorder = true,
            Padding = new Padding(14, 10, 14, 10)
        };
        heroCard.Controls.Add(metricBox);

        var lblDialTitle = new Label
        {
            Text = "SISA HARI SEWA",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Top,
            Height = 18
        };
        metricBox.Controls.Add(lblDialTitle);

        _lblRemainingDays = new Label
        {
            Text = "30",
            Font = new Font("Segoe UI", 32f, FontStyle.Bold),
            ForeColor = FluentTheme.Secondary,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter
        };
        metricBox.Controls.Add(_lblRemainingDays);

        var lblDialSub = new Label
        {
            Text = "Hari Operasional",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextMuted,
            Dock = DockStyle.Bottom,
            Height = 18,
            TextAlign = ContentAlignment.MiddleCenter
        };
        metricBox.Controls.Add(lblDialSub);

        // Left side: Status badge & descriptions
        var heroLeft = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(0, 0, 16, 0)
        };
        heroCard.Controls.Add(heroLeft);

        _pnlStatusBadge = new Panel
        {
            Location = new Point(0, 0),
            Size = new Size(190, 28)
        };
        heroLeft.Controls.Add(_pnlStatusBadge);

        _lblStatusTitle = new Label
        {
            Text = "LISENSI AKTIF",
            Font = FluentTheme.BadgeFont,
            ForeColor = Color.White,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter
        };
        _pnlStatusBadge.Controls.Add(_lblStatusTitle);

        _lblStatusSub = new Label
        {
            Text = "SparkPOS Professional Retail Single-Outlet",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Location = new Point(0, 38),
            Size = new Size(580, 28)
        };
        heroLeft.Controls.Add(_lblStatusSub);

        var lblContract = new Label
        {
            Text = "Terikat secara kriptografis pada CPU ID, Motherboard, dan MAC Address fisik terminal kasir ini. Anti-tamper rollback clock aktif.",
            Font = FluentTheme.BodyFont,
            ForeColor = FluentTheme.TextSecondary,
            Location = new Point(0, 68),
            Size = new Size(580, 44)
        };
        heroLeft.Controls.Add(lblContract);

        // Spacer
        var sp1 = new Panel { Dock = DockStyle.Top, Height = 12 };
        scrollContainer.Controls.Add(sp1);

        // ================= 2. HARDWARE FINGERPRINT CARD =================
        var hwCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 95,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(20, 12, 20, 12),
            Margin = new Padding(0, 0, 0, 12)
        };
        scrollContainer.Controls.Add(hwCard);

        var btnCopy = new ModernButton
        {
            Text = "Salin Fingerprint",
            Dock = DockStyle.Right,
            Width = 160,
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true
        };
        btnCopy.Click += (s, e) =>
        {
            Clipboard.SetText(_licenseManager.CurrentHardwareFingerprint);
            MessageBox.Show("Hardware Fingerprint disalin ke clipboard.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
        };
        hwCard.Controls.Add(btnCopy);

        var hwLeft = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(0, 0, 12, 0)
        };
        hwCard.Controls.Add(hwLeft);

        var lblHwTitle = new Label
        {
            Text = "HARDWARE FINGERPRINT PERANGKAT KASIR",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.PrimaryDark,
            Dock = DockStyle.Top,
            Height = 20
        };
        hwLeft.Controls.Add(lblHwTitle);

        _lblFingerprint = new Label
        {
            Text = _licenseManager.CurrentHardwareFingerprint,
            Font = new Font("Consolas", 13.5f, FontStyle.Bold),
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft
        };
        hwLeft.Controls.Add(_lblFingerprint);

        // Spacer
        var sp2 = new Panel { Dock = DockStyle.Top, Height = 12 };
        scrollContainer.Controls.Add(sp2);

        // ================= 3. DUAL ACTIVATION CARD =================
        var actCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 245,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(20, 14, 20, 14)
        };
        scrollContainer.Controls.Add(actCard);

        var lblActTitle = new Label
        {
            Text = "AKTIVASI LISENSI (MENDUKUNG KEDUA FORMAT)",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 28
        };
        actCard.Controls.Add(lblActTitle);

        // Format 1: Serial Key
        var lblSerial = new Label
        {
            Text = "Format 1: Masukkan Serial Key (contoh: SPARK-03E8-XXXX-000E-XXXX)",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextSecondary,
            Location = new Point(20, 46),
            AutoSize = true
        };
        actCard.Controls.Add(lblSerial);

        var serialRow = new TableLayoutPanel
        {
            Location = new Point(20, 72),
            Size = new Size(800, 38),
            ColumnCount = 2,
            RowCount = 1
        };
        serialRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
        serialRow.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 180f));
        actCard.Controls.Add(serialRow);

        _txtSerialKey = new TextBox
        {
            Font = new Font("Consolas", 13f, FontStyle.Bold),
            Dock = DockStyle.Fill,
            PlaceholderText = "SPARK-XXXX-XXXX-XXXX-XXXX"
        };
        serialRow.Controls.Add(_txtSerialKey, 0, 0);

        var btnActivateSerial = new ModernButton
        {
            Text = "Aktivasi Serial",
            Dock = DockStyle.Fill,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White
        };
        btnActivateSerial.Click += (s, e) => ActivateSerial();
        serialRow.Controls.Add(btnActivateSerial, 1, 0);

        // Format 2: File License (.lic)
        var lblFile = new Label
        {
            Text = "Format 2: Unggah File Lisensi Terenkripsi (.lic bertanda tangan RSA-2048)",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextSecondary,
            Location = new Point(20, 126),
            AutoSize = true
        };
        actCard.Controls.Add(lblFile);

        var fileFlow = new FlowLayoutPanel
        {
            Location = new Point(20, 154),
            Size = new Size(800, 48),
            WrapContents = false
        };
        actCard.Controls.Add(fileFlow);

        var btnImportFile = new ModernButton
        {
            Text = "Import File Lisensi (.lic)...",
            Size = new Size(240, 40),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 10, 0)
        };
        btnImportFile.Click += (s, e) => ImportLicenseFile();
        fileFlow.Controls.Add(btnImportFile);

        _btnTrial = new ModernButton
        {
            Text = "Coba Trial 30 Hari",
            Size = new Size(220, 40),
            NormalBackColor = FluentTheme.Secondary,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont
        };
        _btnTrial.Click += (s, e) => StartTrial();
        fileFlow.Controls.Add(_btnTrial);

        // Resize handler for actCard
        actCard.Resize += (s, e) =>
        {
            int targetW = actCard.ClientSize.Width - 40;
            if (targetW > 300)
            {
                serialRow.Width = targetW;
                fileFlow.Width = targetW;
            }
        };

        // ================= 4. DATABASE BACKUP & RESTORE CARD =================
        var sp3 = new Panel { Dock = DockStyle.Top, Height = 12, BackColor = Color.Transparent };
        scrollContainer.Controls.Add(sp3);

        var backupCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 220,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(20, 16, 20, 16),
            Margin = new Padding(0, 0, 0, 16)
        };
        scrollContainer.Controls.Add(backupCard);

        var lblBackupTitle = new Label
        {
            Text = "PENCADANGAN & PEMULIHAN DATABASE (BACKUP & RESTORE)",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Location = new Point(20, 16),
            AutoSize = true
        };
        backupCard.Controls.Add(lblBackupTitle);

        var lblBackupSub = new Label
        {
            Text = "Amankan salinan database transaksi dan katalog produk SQLite ke flashdisk/drive lain, atau pulihkan data dari file cadangan.",
            Font = FluentTheme.BodyFont,
            ForeColor = FluentTheme.TextSecondary,
            Location = new Point(20, 42),
            AutoSize = true
        };
        backupCard.Controls.Add(lblBackupSub);

        // Database Info Panel
        var infoPanel = new ModernPanel
        {
            Location = new Point(20, 70),
            Size = new Size(800, 52),
            BackColor = FluentTheme.SurfaceHigh,
            Padding = new Padding(14, 8, 14, 8)
        };
        backupCard.Controls.Add(infoPanel);

        _lblDbPath = new Label
        {
            Text = "Lokasi Database: ...",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 18,
            AutoEllipsis = true
        };
        infoPanel.Controls.Add(_lblDbPath);

        _lblDbSize = new Label
        {
            Text = "Ukuran Database: Menghitung...",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Top,
            Height = 18
        };
        infoPanel.Controls.Add(_lblDbSize);

        // Action Buttons Row
        var backupFlow = new FlowLayoutPanel
        {
            Location = new Point(20, 136),
            Size = new Size(800, 48),
            WrapContents = false
        };
        backupCard.Controls.Add(backupFlow);

        var btnExport = new ModernButton
        {
            Text = "Ekspor / Backup Database (.db)",
            Size = new Size(245, 40),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 10, 0)
        };
        btnExport.Click += async (s, e) => await ExportDatabaseAsync();
        backupFlow.Controls.Add(btnExport);

        var btnImport = new ModernButton
        {
            Text = "Impor / Pulihkan Database (.db)",
            Size = new Size(245, 40),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.Danger,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 10, 0)
        };
        btnImport.Click += async (s, e) => await ImportDatabaseAsync();
        backupFlow.Controls.Add(btnImport);

        var btnOpenFolder = new ModernButton
        {
            Text = "Buka Folder Data",
            Size = new Size(160, 40),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont
        };
        btnOpenFolder.Click += (s, e) => OpenDataFolder();
        backupFlow.Controls.Add(btnOpenFolder);

        // Resize handler for backupCard
        backupCard.Resize += (s, e) =>
        {
            int targetW = backupCard.ClientSize.Width - 40;
            if (targetW > 300)
            {
                infoPanel.Width = targetW;
                backupFlow.Width = targetW;
            }
        };

        // Control order inside scrollContainer
        pnlHeader.BringToFront();
        heroCard.BringToFront();
        sp1.BringToFront();
        hwCard.BringToFront();
        sp2.BringToFront();
        actCard.BringToFront();
        sp3.BringToFront();
        backupCard.BringToFront();
    }

    public void RefreshDisplay()
    {
        var res = _licenseManager.EvaluateLicense();

        switch (res.Status)
        {
            case LicenseStatus.Active:
                _pnlStatusBadge.BackColor = FluentTheme.Secondary;
                _lblStatusTitle.Text = res.IsTrial ? "TRIAL AKTIF (30 HARI)" : "LISENSI AKTIF";
                _lblRemainingDays.Text = res.RemainingDays.ToString();
                _lblRemainingDays.ForeColor = FluentTheme.Secondary;
                _lblStatusSub.Text = res.Message;
                break;

            case LicenseStatus.GracePeriod:
                _pnlStatusBadge.BackColor = FluentTheme.Tertiary;
                _lblStatusTitle.Text = "MASA TENGGANG (GRACE)";
                _lblRemainingDays.Text = res.RemainingGraceDays.ToString();
                _lblRemainingDays.ForeColor = FluentTheme.Tertiary;
                _lblStatusSub.Text = res.Message;
                break;

            case LicenseStatus.Expired:
                _pnlStatusBadge.BackColor = FluentTheme.Danger;
                _lblStatusTitle.Text = res.IsTrial ? "TRIAL HABIS (LOCKDOWN)" : "KEDALUWARSA (READ-ONLY)";
                _lblRemainingDays.Text = "0";
                _lblRemainingDays.ForeColor = FluentTheme.Danger;
                _lblStatusSub.Text = res.Message;
                break;

            case LicenseStatus.Tampered:
                _pnlStatusBadge.BackColor = FluentTheme.Danger;
                _lblStatusTitle.Text = "MANIPULASI JAM TERDETEKSI";
                _lblRemainingDays.Text = "LOCK";
                _lblRemainingDays.ForeColor = FluentTheme.Danger;
                _lblStatusSub.Text = res.Message;
                break;

            default:
                _pnlStatusBadge.BackColor = FluentTheme.TextMuted;
                _lblStatusTitle.Text = "BELUM AKTIF";
                _lblRemainingDays.Text = "-";
                _lblRemainingDays.ForeColor = FluentTheme.TextMuted;
                _lblStatusSub.Text = "Terminal belum diaktivasi. Anda dapat mencoba Trial 30 Hari atau memasukkan Serial Key.";
                break;
        }

        if (_btnTrial != null)
        {
            if (_licenseManager.HasUsedTrial)
            {
                _btnTrial.Enabled = false;
                _btnTrial.Text = "Trial Telah Digunakan";
                _btnTrial.NormalBackColor = FluentTheme.SurfaceHigh;
                _btnTrial.NormalForeColor = FluentTheme.TextMuted;
                _btnTrial.ShowBorder = true;
            }
            else
            {
                _btnTrial.Enabled = true;
                _btnTrial.Text = "Coba Trial 30 Hari";
                _btnTrial.NormalBackColor = FluentTheme.Secondary;
                _btnTrial.NormalForeColor = Color.White;
                _btnTrial.ShowBorder = false;
            }
            _btnTrial.Invalidate();
        }

        if (_backupService != null && _lblDbPath != null && _lblDbSize != null)
        {
            _lblDbPath.Text = $"Lokasi Database: {_backupService.GetDatabasePath()}";
            _lblDbSize.Text = $"Ukuran Database Saat Ini: {_backupService.GetDatabaseSizeFormatted()}";
        }
    }

    private void ActivateSerial()
    {
        string key = _txtSerialKey.Text.Trim();
        if (string.IsNullOrEmpty(key))
        {
            MessageBox.Show("Masukkan serial key terlebih dahulu.", "Perhatian", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var res = _licenseManager.ActivateWithSerialKey(key);
        if (res.IsValid)
        {
            RefreshDisplay();
            LicenseUpdated?.Invoke();
            MessageBox.Show($"Aktivasi Serial Key Berhasil!\n\nStatus: {res.Status}\nSisa Hari: {res.RemainingDays}", "Aktivasi Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        else
        {
            MessageBox.Show($"Gagal mengaktivasi lisensi: {res.Message}", "Aktivasi Gagal", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void ImportLicenseFile()
    {
        using var ofd = new OpenFileDialog
        {
            Filter = "License Files (*.lic)|*.lic|All Files (*.*)|*.*",
            Title = "Pilih File Lisensi SparkPOS (.lic)"
        };

        if (ofd.ShowDialog(this) == DialogResult.OK)
        {
            var res = _licenseManager.ActivateWithLicenseFile(ofd.FileName);
            if (res.IsValid)
            {
                RefreshDisplay();
                LicenseUpdated?.Invoke();
                MessageBox.Show($"Aktivasi File Lisensi Berhasil!\n\nKlien: {res.Payload?.ClientName}\nSisa Hari: {res.RemainingDays}", "Aktivasi Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                MessageBox.Show($"Gagal memvalidasi file lisensi: {res.Message}", "Aktivasi Gagal", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    private void StartTrial()
    {
        if (_licenseManager.HasUsedTrial)
        {
            MessageBox.Show(
                "Masa percobaan (Trial 30 Hari) sudah pernah digunakan pada terminal kasir ini.\n\nSilakan hubungi pemilik/developer untuk membeli lisensi resmi.",
                "Trial Tidak Tersedia",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        var confirm = MessageBox.Show(
            "Mulai Masa Percobaan (Trial 30 Hari)?\n\nSeluruh fitur kasir, katalog produk, dan laporan dapat digunakan secara penuh selama 30 hari ke depan.",
            "Konfirmasi Mulai Trial",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);

        if (confirm == DialogResult.Yes)
        {
            var res = _licenseManager.StartTrial30Days();
            RefreshDisplay();
            LicenseUpdated?.Invoke();

            if (res.IsValid)
            {
                MessageBox.Show(
                    "Masa Percobaan (Trial 30 Hari) berhasil diaktifkan!\n\nSistem kasir siap digunakan secara penuh.",
                    "Trial Berhasil Dimulai",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            else
            {
                MessageBox.Show($"Gagal memulai trial: {res.Message}", "Info", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }

    private async Task ExportDatabaseAsync()
    {
        if (_backupService == null) return;

        using var sfd = new SaveFileDialog
        {
            Filter = "SQLite Database (*.db)|*.db|All Files (*.*)|*.*",
            InitialDirectory = _backupService.GetDefaultBackupDirectory(),
            FileName = _backupService.GenerateDefaultBackupFileName(),
            Title = "Pilih Lokasi Penyimpanan Cadangan Database (Default: Documents)"
        };

        if (sfd.ShowDialog(this) == DialogResult.OK)
        {
            try
            {
                Cursor = Cursors.WaitCursor;
                long bytes = await _backupService.ExportBackupAsync(sfd.FileName);
                Cursor = Cursors.Default;

                string sizeStr = bytes < 1024 * 1024 ? $"{bytes / 1024.0:F1} KB" : $"{bytes / (1024.0 * 1024.0):F2} MB";
                var ask = MessageBox.Show(
                    $"Pencadangan database berhasil diselesaikan!\n\n" +
                    $"File Target : {sfd.FileName}\n" +
                    $"Ukuran File : {sizeStr}\n\n" +
                    $"Apakah Anda ingin membuka folder lokasi cadangan?",
                    "Backup Database Sukses",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information);

                if (ask == DialogResult.Yes)
                {
                    Process.Start("explorer.exe", $"/select,\"{sfd.FileName}\"");
                }
            }
            catch (Exception ex)
            {
                Cursor = Cursors.Default;
                MessageBox.Show($"Gagal melakukan ekspor database: {ex.Message}", "Error Ekspor", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    private async Task ImportDatabaseAsync()
    {
        if (_backupService == null) return;

        var confirm = MessageBox.Show(
            "PERINGATAN PEMULIHAN DATABASE:\n\n" +
            "Memulihkan database akan menimpa seluruh riwayat transaksi, master produk, dan shift kasir yang sedang aktif dengan data dari file cadangan yang dipilih.\n\n" +
            "Sistem secara otomatis akan membuat salinan pengaman (auto safety backup) dari database saat ini sebelum pemulihan dilakukan.\n\n" +
            "Apakah Anda yakin ingin melanjutkan?",
            "Konfirmasi Pemulihan Database",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning);

        if (confirm != DialogResult.Yes) return;

        using var ofd = new OpenFileDialog
        {
            Filter = "SQLite Database (*.db)|*.db|All Files (*.*)|*.*",
            InitialDirectory = _backupService.GetDefaultBackupDirectory(),
            Title = "Pilih File Database Cadangan untuk Dipulihkan"
        };

        if (ofd.ShowDialog(this) == DialogResult.OK)
        {
            try
            {
                Cursor = Cursors.WaitCursor;
                await _backupService.ImportBackupAsync(ofd.FileName);
                Cursor = Cursors.Default;

                RefreshDisplay();
                DatabaseRestored?.Invoke();

                MessageBox.Show(
                    "Pemulihan database berhasil diselesaikan secara utuh!\n\n" +
                    "Seluruh data transaksi dan produk telah disinkronkan kembali.",
                    "Pemulihan Berhasil",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                Cursor = Cursors.Default;
                MessageBox.Show($"Gagal memulihkan database: {ex.Message}", "Error Pemulihan", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    private void OpenDataFolder()
    {
        if (_backupService == null) return;
        string dir = Path.GetDirectoryName(_backupService.GetDatabasePath())!;
        if (Directory.Exists(dir))
        {
            Process.Start("explorer.exe", $"\"{dir}\"");
        }
    }
}
