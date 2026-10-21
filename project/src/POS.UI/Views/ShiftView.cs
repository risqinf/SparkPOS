using System;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Application;
using POS.Domain;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Views;

public class ShiftView : UserControl
{
    private readonly ShiftService _shiftService;
    private readonly AuthService _authService;
    private readonly IShiftRepository _shiftRepo;

    private Label _lblShiftStatus = null!;
    private Label _lblCashierName = null!;
    private Label _lblStartTime = null!;
    private Label _lblOpeningCash = null!;
    private Label _lblExpectedCash = null!;
    private Label _lblCashSales = null!;
    private Label _lblNonCashSales = null!;
    private TextBox _txtClosingCash = null!;
    private TextBox _txtShiftNote = null!;
    private ModernButton _btnOpenShift = null!;
    private ModernButton _btnCloseShift = null!;
    private DataGridView _gridPastShifts = null!;

    public event Action? ShiftStatusChanged;

    public ShiftView(ShiftService shiftService, AuthService authService, IShiftRepository shiftRepo)
    {
        _shiftService = shiftService;
        _authService = authService;
        _shiftRepo = shiftRepo;

        InitializeComponent();
        _ = RefreshShiftDataAsync();
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

        var lblTitle = new Label
        {
            Text = "Buka / Tutup Shift Kasir (§8.1 PRD)",
            Font = FluentTheme.HeadlineLgFont,
            ForeColor = FluentTheme.TextPrimary,
            AutoSize = true,
            Margin = new Padding(0, 0, 0, 6)
        };
        pnlHeader.Controls.Add(lblTitle);

        var lblSub = new Label
        {
            Text = "Manajemen sesi kasir, modal kas awal, rekonsiliasi kas fisik laci, dan riwayat tutup shift.",
            Font = FluentTheme.BodyFont,
            ForeColor = FluentTheme.TextSecondary,
            AutoSize = true,
            Margin = new Padding(0)
        };
        pnlHeader.Controls.Add(lblSub);

        // ================= 1. ACTIVE SHIFT CARD =================
        var activeCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 225,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(20, 14, 20, 14),
            Margin = new Padding(0, 0, 0, 12)
        };
        scrollContainer.Controls.Add(activeCard);

        _lblShiftStatus = new Label
        {
            Text = "● STATUS SHIFT: AKTIF (TERBUKA)",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.Secondary,
            Dock = DockStyle.Top,
            Height = 28
        };
        activeCard.Controls.Add(_lblShiftStatus);

        var gridMetrics = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 85,
            ColumnCount = 4,
            RowCount = 2,
            Padding = new Padding(0, 8, 0, 4)
        };
        for (int i = 0; i < 4; i++) gridMetrics.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25f));
        activeCard.Controls.Add(gridMetrics);

        gridMetrics.Controls.Add(new Label { Text = "Kasir Aktif:", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill }, 0, 0);
        _lblCashierName = new Label { Text = "Siti Rahma", Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.TextPrimary, Dock = DockStyle.Fill };
        gridMetrics.Controls.Add(_lblCashierName, 0, 1);

        gridMetrics.Controls.Add(new Label { Text = "Waktu Mulai Shift:", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill }, 1, 0);
        _lblStartTime = new Label { Text = "-", Font = FluentTheme.SubheadFont, ForeColor = FluentTheme.TextPrimary, Dock = DockStyle.Fill };
        gridMetrics.Controls.Add(_lblStartTime, 1, 1);

        gridMetrics.Controls.Add(new Label { Text = "Kas Awal (Modal):", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill }, 2, 0);
        _lblOpeningCash = new Label { Text = "Rp 0", Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.PrimaryDark, Dock = DockStyle.Fill };
        gridMetrics.Controls.Add(_lblOpeningCash, 2, 1);

        gridMetrics.Controls.Add(new Label { Text = "Ekspektasi Kas Laci:", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill }, 3, 0);
        _lblExpectedCash = new Label { Text = "Rp 0", Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.Secondary, Dock = DockStyle.Fill };
        gridMetrics.Controls.Add(_lblExpectedCash, 3, 1);

        // Sales mini summary strip
        var pnlSales = new ModernPanel
        {
            Dock = DockStyle.Bottom,
            Height = 50,
            BackColor = FluentTheme.SurfaceLow,
            Padding = new Padding(14, 10, 14, 10)
        };
        activeCard.Controls.Add(pnlSales);

        var salesLayout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1
        };
        salesLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        salesLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        pnlSales.Controls.Add(salesLayout);

        _lblCashSales = new Label
        {
            Text = "Penjualan Tunai: Rp 0",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft
        };
        salesLayout.Controls.Add(_lblCashSales, 0, 0);

        _lblNonCashSales = new Label
        {
            Text = "Penjualan Non-Tunai (QRIS/Debit): Rp 0",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft
        };
        salesLayout.Controls.Add(_lblNonCashSales, 1, 0);

        // Spacer
        var sp1 = new Panel { Dock = DockStyle.Top, Height = 12 };
        scrollContainer.Controls.Add(sp1);

        // ================= 2. ACTIONS: OPEN / CLOSE SHIFT CARD =================
        var actionCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 145,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(20, 14, 20, 14),
            Margin = new Padding(0, 0, 0, 12)
        };
        scrollContainer.Controls.Add(actionCard);

        var lblActionTitle = new Label
        {
            Text = "REKONSILIASI PENUTUPAN SHIFT",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 26
        };
        actionCard.Controls.Add(lblActionTitle);

        var actionControlsPanel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 3,
            RowCount = 2,
            Padding = new Padding(0, 4, 0, 0)
        };
        actionControlsPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 240f));
        actionControlsPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
        actionControlsPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 200f));
        actionCard.Controls.Add(actionControlsPanel);

        actionControlsPanel.Controls.Add(new Label { Text = "Hitungan Kas Fisik Akhir (Rp):", Font = FluentTheme.SubheadFont, ForeColor = FluentTheme.TextPrimary, Dock = DockStyle.Fill }, 0, 0);
        _txtClosingCash = new TextBox
        {
            Font = new Font("Segoe UI", 12f, FontStyle.Bold),
            Dock = DockStyle.Fill,
            TextAlign = HorizontalAlignment.Right
        };
        actionControlsPanel.Controls.Add(_txtClosingCash, 0, 1);

        actionControlsPanel.Controls.Add(new Label { Text = "Catatan Rekonsiliasi Kasir:", Font = FluentTheme.SubheadFont, ForeColor = FluentTheme.TextPrimary, Dock = DockStyle.Fill }, 1, 0);
        _txtShiftNote = new TextBox
        {
            Font = FluentTheme.BodyFont,
            Dock = DockStyle.Fill,
            PlaceholderText = "Keterangan selisih atau catatan serah terima..."
        };
        actionControlsPanel.Controls.Add(_txtShiftNote, 1, 1);

        _btnCloseShift = new ModernButton
        {
            Text = "Tutup Shift",
            Dock = DockStyle.Fill,
            NormalBackColor = FluentTheme.Danger,
            HoverBackColor = FluentTheme.DangerHover,
            NormalForeColor = Color.White
        };
        _btnCloseShift.Click += async (s, e) => await CloseShiftAsync();
        actionControlsPanel.Controls.Add(_btnCloseShift, 2, 1);

        _btnOpenShift = new ModernButton
        {
            Text = "Buka Shift Baru",
            Size = new Size(220, 42),
            Location = new Point(20, 50),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Visible = false
        };
        _btnOpenShift.Click += async (s, e) => await OpenShiftAsync();
        actionCard.Controls.Add(_btnOpenShift);

        // Spacer
        var sp2 = new Panel { Dock = DockStyle.Top, Height = 12 };
        scrollContainer.Controls.Add(sp2);

        // ================= 3. RIWAYAT SHIFT SEBELUMNYA =================
        var pastCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 310,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(20, 14, 20, 14)
        };
        scrollContainer.Controls.Add(pastCard);

        var lblPastTitle = new Label
        {
            Text = "RIWAYAT SHIFT SEBELUMNYA (AUDIT TRAIL)",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 30
        };
        pastCard.Controls.Add(lblPastTitle);

        _gridPastShifts = new DataGridView
        {
            Dock = DockStyle.Fill
        };
        FluentTheme.ApplyModernGridStyle(_gridPastShifts);

        _gridPastShifts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "ID", Width = 50 });
        _gridPastShifts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Kasir", Width = 150 });
        _gridPastShifts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Waktu Mulai", Width = 145 });
        _gridPastShifts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Waktu Selesai", Width = 145 });
        _gridPastShifts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Kas Awal", Width = 110, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight } });
        _gridPastShifts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Kas Akhir", Width = 110, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight } });
        _gridPastShifts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Selisih", Width = 105, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight, Font = FluentTheme.BodyBoldFont } });
        _gridPastShifts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Status", FillWeight = 20, AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });

        pastCard.Controls.Add(_gridPastShifts);
        _gridPastShifts.BringToFront();

        // Control order inside scrollContainer: header first, then activeCard, then sp1, then actionCard, then sp2, then pastCard
        pnlHeader.BringToFront();
        activeCard.BringToFront();
        sp1.BringToFront();
        actionCard.BringToFront();
        sp2.BringToFront();
        pastCard.BringToFront();
    }

    public async Task RefreshShiftDataAsync()
    {
        int empId = _authService.CurrentEmployee?.Id ?? 1;
        var activeShift = await _shiftService.LoadActiveShiftAsync(empId);

        if (activeShift != null)
        {
            _lblShiftStatus.Text = "● STATUS SHIFT: AKTIF (TERBUKA)";
            _lblShiftStatus.ForeColor = FluentTheme.Secondary;
            _lblCashierName.Text = activeShift.EmployeeName;
            _lblStartTime.Text = activeShift.StartTime.ToString("dd MMM yyyy HH:mm");
            _lblOpeningCash.Text = $"Rp {activeShift.OpeningCash:N0}";

            var (expected, cashSales, nonCashSales, count) = await _shiftService.CalculateShiftSummaryAsync(activeShift.Id);
            _lblExpectedCash.Text = $"Rp {expected:N0}";
            _lblCashSales.Text = $"Penjualan Tunai ({count} trx): Rp {cashSales:N0}";
            _lblNonCashSales.Text = $"Penjualan Non-Tunai: Rp {nonCashSales:N0}";

            _txtClosingCash.Text = expected.ToString("0");
            _btnOpenShift.Visible = false;
            _btnCloseShift.Visible = true;
            _txtClosingCash.Visible = true;
            _txtShiftNote.Visible = true;
        }
        else
        {
            _lblShiftStatus.Text = "● STATUS SHIFT: TIDAK ADA SHIFT TERBUKA";
            _lblShiftStatus.ForeColor = FluentTheme.Danger;
            _lblCashierName.Text = _authService.CurrentEmployee?.FullName ?? "-";
            _lblStartTime.Text = "-";
            _lblOpeningCash.Text = "Rp 0";
            _lblExpectedCash.Text = "Rp 0";
            _lblCashSales.Text = "Penjualan Tunai: Rp 0";
            _lblNonCashSales.Text = "Penjualan Non-Tunai: Rp 0";

            _btnOpenShift.Visible = true;
            _btnCloseShift.Visible = false;
            _txtClosingCash.Visible = false;
            _txtShiftNote.Visible = false;
        }

        // Load Past Shifts
        var recent = (await _shiftRepo.GetRecentShiftsAsync(15)).ToList();
        _gridPastShifts.Rows.Clear();
        foreach (var s in recent)
        {
            string statusStr = s.IsClosed ? (s.Discrepancy == 0 ? "Seimbang" : s.Discrepancy > 0 ? "Lebih" : "Kurang") : "Aktif";
            _gridPastShifts.Rows.Add(
                s.Id,
                s.EmployeeName,
                s.StartTime.ToString("dd/MM/yy HH:mm"),
                s.EndTime?.ToString("dd/MM/yy HH:mm") ?? "-",
                $"Rp {s.OpeningCash:N0}",
                s.ClosingCash.HasValue ? $"Rp {s.ClosingCash.Value:N0}" : "-",
                $"Rp {s.Discrepancy:N0}",
                statusStr
            );
        }
    }

    private async Task OpenShiftAsync()
    {
        using var prompt = new Form
        {
            Width = 420,
            Height = 240,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            Text = "Buka Shift Kasir Baru",
            StartPosition = FormStartPosition.CenterParent,
            BackColor = FluentTheme.Background,
            MaximizeBox = false,
            MinimizeBox = false,
            Font = FluentTheme.BodyFont
        };

        var pnl = new ModernPanel { Dock = DockStyle.Fill, Margin = new Padding(12), BackColor = FluentTheme.Surface };
        prompt.Controls.Add(pnl);

        pnl.Controls.Add(new Label { Left = 20, Top = 18, Text = "Modal Kas Awal Kasir (Rp):", Font = FluentTheme.SubheadFont, AutoSize = true });
        var txt = new TextBox { Left = 20, Top = 46, Width = 360, Font = new Font("Segoe UI", 13f, FontStyle.Bold), Text = "100000", TextAlign = HorizontalAlignment.Right };
        pnl.Controls.Add(txt);

        var btnOk = new ModernButton { Text = "Buka Shift", Left = 200, Width = 180, Top = 105, Height = 42, NormalBackColor = FluentTheme.Primary, NormalForeColor = Color.White };
        var btnCancel = new ModernButton { Text = "Batal", Left = 20, Width = 160, Top = 105, Height = 42, NormalBackColor = FluentTheme.SurfaceHigh, NormalForeColor = FluentTheme.TextPrimary, ShowBorder = true };

        btnOk.Click += (s, e) => { prompt.DialogResult = DialogResult.OK; prompt.Close(); };
        btnCancel.Click += (s, e) => { prompt.DialogResult = DialogResult.Cancel; prompt.Close(); };

        pnl.Controls.Add(btnOk);
        pnl.Controls.Add(btnCancel);

        if (prompt.ShowDialog(this) == DialogResult.OK)
        {
            if (decimal.TryParse(txt.Text.Replace(".", "").Replace(",", "").Trim(), out decimal openingCash) && openingCash >= 0)
            {
                int empId = _authService.CurrentEmployee?.Id ?? 1;
                string empName = _authService.CurrentEmployee?.FullName ?? "Kasir 01";
                await _shiftService.OpenShiftAsync(empId, empName, openingCash);
                await RefreshShiftDataAsync();
                ShiftStatusChanged?.Invoke();
                MessageBox.Show($"Shift kasir berhasil dibuka dengan modal awal Rp {openingCash:N0}.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
    }

    private async Task CloseShiftAsync()
    {
        if (_shiftService.CurrentShift == null) return;

        string raw = _txtClosingCash.Text.Replace(".", "").Replace(",", "").Trim();
        if (!decimal.TryParse(raw, out decimal closingCash))
        {
            MessageBox.Show("Masukkan nominal kas fisik akhir.", "Peringatan", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var res = MessageBox.Show(
            $"Apakah Anda yakin ingin menutup shift ini?\n\nKas Fisik Dihitung: Rp {closingCash:N0}", 
            "Konfirmasi Tutup Shift", 
            MessageBoxButtons.YesNo, 
            MessageBoxIcon.Question);

        if (res == DialogResult.Yes)
        {
            var closed = await _shiftService.CloseShiftAsync(_shiftService.CurrentShift.Id, closingCash, _txtShiftNote.Text.Trim());
            await RefreshShiftDataAsync();
            ShiftStatusChanged?.Invoke();

            string statusSelisih = closed.Discrepancy == 0 ? "SEIMBANG (Rp 0)" :
                closed.Discrepancy > 0 ? $"LEBIH (+Rp {closed.Discrepancy:N0})" : $"KURANG (-Rp {Math.Abs(closed.Discrepancy):N0})";

            MessageBox.Show(
                $"Shift berhasil ditutup!\n\nKas Awal: Rp {closed.OpeningCash:N0}\nEkspektasi Kas: Rp {closed.ExpectedCash:N0}\nKas Fisik: Rp {closed.ClosingCash:N0}\nStatus: {statusSelisih}",
                "Rekonsiliasi Shift Selesai",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
    }
}
