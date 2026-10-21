using System;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Application;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Views;

public class ReportView : UserControl
{
    private readonly ReportService _reportService;

    private DateTimePicker _dtpDate = null!;
    private Label _lblRevenue = null!;
    private Label _lblTxCount = null!;
    private Label _lblAvgTicket = null!;
    private Label _lblTotalDiscount = null!;
    private Label _lblTotalTax = null!;
    private Label _lblCashSales = null!;
    private Label _lblQrisSales = null!;
    private Label _lblDebitSales = null!;
    private DataGridView _gridTopProducts = null!;

    public ReportView(ReportService reportService)
    {
        _reportService = reportService;
        InitializeComponent();
        _ = LoadReportDataAsync();
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
            Text = "Laporan Transaksi & Analisis Penjualan (§8.7 PRD)",
            Font = FluentTheme.HeadlineLgFont,
            ForeColor = FluentTheme.TextPrimary,
            AutoSize = true,
            Margin = new Padding(0, 0, 0, 6)
        };
        pnlHeader.Controls.Add(lblTitle);

        var lblSub = new Label
        {
            Text = "Ringkasan omzet harian, performa produk terlaris, dan rincian metode pembayaran non-tunai/tunai.",
            Font = FluentTheme.BodyFont,
            ForeColor = FluentTheme.TextSecondary,
            AutoSize = true,
            Margin = new Padding(0)
        };
        pnlHeader.Controls.Add(lblSub);

        // ================= 1. DATE FILTER CARD =================
        var filterCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 58,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(16, 12, 16, 12),
            Margin = new Padding(0, 0, 0, 12)
        };
        scrollContainer.Controls.Add(filterCard);

        var filterFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            WrapContents = false
        };
        filterCard.Controls.Add(filterFlow);

        var lblPrompt = new Label
        {
            Text = "Pilih Tanggal Laporan:",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextPrimary,
            AutoSize = true,
            Margin = new Padding(0, 6, 12, 0)
        };
        filterFlow.Controls.Add(lblPrompt);

        _dtpDate = new DateTimePicker
        {
            Format = DateTimePickerFormat.Short,
            Size = new Size(150, 32),
            Font = FluentTheme.BodyBoldFont,
            Value = DateTime.Today,
            Margin = new Padding(0, 2, 12, 0)
        };
        _dtpDate.ValueChanged += async (s, e) => await LoadReportDataAsync();
        filterFlow.Controls.Add(_dtpDate);

        var btnRefresh = new ModernButton
        {
            Text = "Muat Ulang",
            Size = new Size(120, 32),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 1, 0, 0)
        };
        btnRefresh.Click += async (s, e) => await LoadReportDataAsync();
        filterFlow.Controls.Add(btnRefresh);

        // Spacer
        var sp1 = new Panel { Dock = DockStyle.Top, Height = 12 };
        scrollContainer.Controls.Add(sp1);

        // ================= 2. REVENUE METRICS BENTO GRID =================
        var metricsGrid = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 95,
            ColumnCount = 3,
            RowCount = 1,
            Margin = new Padding(0, 0, 0, 12)
        };
        metricsGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 35f));
        metricsGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 32f));
        metricsGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33f));
        scrollContainer.Controls.Add(metricsGrid);

        // Card 1: Total Omzet
        var cardRevenue = CreateReportMetricCard("TOTAL OMZET PENJUALAN", out _lblRevenue, "Rp 0", FluentTheme.Secondary, FluentTheme.Secondary);
        metricsGrid.Controls.Add(cardRevenue, 0, 0);

        // Card 2: Total Transaksi
        var cardTx = CreateReportMetricCard("JUMLAH TRANSAKSI", out _lblTxCount, "0 Transaksi", FluentTheme.PrimaryDark, FluentTheme.Primary);
        metricsGrid.Controls.Add(cardTx, 1, 0);

        // Card 3: Rata-rata Belanja
        var cardAvg = CreateReportMetricCard("RATA-RATA TRANSAKSI", out _lblAvgTicket, "Rp 0", FluentTheme.TextPrimary, FluentTheme.Tertiary);
        metricsGrid.Controls.Add(cardAvg, 2, 0);

        // Spacer
        var sp2 = new Panel { Dock = DockStyle.Top, Height = 12 };
        scrollContainer.Controls.Add(sp2);

        // ================= 3. BREAKDOWN ROW: DISCOUNTS, TAX & PAYMENTS =================
        var splitRow = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 130,
            ColumnCount = 2,
            RowCount = 1,
            Margin = new Padding(0, 0, 0, 12)
        };
        splitRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        splitRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        scrollContainer.Controls.Add(splitRow);

        // Discounts & Tax Card
        var cardDiscounts = new ModernPanel { Dock = DockStyle.Fill, Margin = new Padding(0, 0, 8, 0), Padding = new Padding(16, 12, 16, 12) };
        cardDiscounts.Controls.Add(new Label { Text = "RINGKASAN POTONGAN & PAJAK", Dock = DockStyle.Top, Height = 22, Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary });
        _lblTotalDiscount = new Label { Text = "Total Diskon Diberikan: Rp 0", Dock = DockStyle.Top, Height = 32, Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.Danger, TextAlign = ContentAlignment.MiddleLeft };
        cardDiscounts.Controls.Add(_lblTotalDiscount);
        _lblTotalTax = new Label { Text = "Total PPN (11%): Rp 0", Dock = DockStyle.Top, Height = 32, Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.TextPrimary, TextAlign = ContentAlignment.MiddleLeft };
        cardDiscounts.Controls.Add(_lblTotalTax);
        splitRow.Controls.Add(cardDiscounts, 0, 0);

        // Payment Methods Card
        var cardPayments = new ModernPanel { Dock = DockStyle.Fill, Margin = new Padding(8, 0, 0, 0), Padding = new Padding(16, 12, 16, 12) };
        cardPayments.Controls.Add(new Label { Text = "RINCIAN METODE PEMBAYARAN", Dock = DockStyle.Top, Height = 22, Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary });
        _lblCashSales = new Label { Text = "Tunai (Cash): Rp 0", Dock = DockStyle.Top, Height = 26, Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.TextPrimary, TextAlign = ContentAlignment.MiddleLeft };
        cardPayments.Controls.Add(_lblCashSales);
        _lblQrisSales = new Label { Text = "QRIS / E-Wallet: Rp 0", Dock = DockStyle.Top, Height = 26, Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.TextPrimary, TextAlign = ContentAlignment.MiddleLeft };
        cardPayments.Controls.Add(_lblQrisSales);
        _lblDebitSales = new Label { Text = "Kartu Debit/Kredit: Rp 0", Dock = DockStyle.Top, Height = 26, Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.TextPrimary, TextAlign = ContentAlignment.MiddleLeft };
        cardPayments.Controls.Add(_lblDebitSales);
        splitRow.Controls.Add(cardPayments, 1, 0);

        // Spacer
        var sp3 = new Panel { Dock = DockStyle.Top, Height = 12 };
        scrollContainer.Controls.Add(sp3);

        // ================= 4. TOP 10 PRODUCTS TABLE =================
        var cardProducts = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 320,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(16, 12, 16, 12)
        };
        scrollContainer.Controls.Add(cardProducts);

        var lblTopTitle = new Label
        {
            Text = "PRODUK TERLARIS (TOP 10 PERIODE INI)",
            Dock = DockStyle.Top,
            Height = 30,
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary
        };
        cardProducts.Controls.Add(lblTopTitle);

        _gridTopProducts = new DataGridView
        {
            Dock = DockStyle.Fill
        };
        FluentTheme.ApplyModernGridStyle(_gridTopProducts);
        _gridTopProducts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "SKU", Width = 120 });
        _gridTopProducts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Nama Produk", FillWeight = 50, AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
        _gridTopProducts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Qty Terjual", Width = 120, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter } });
        _gridTopProducts.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Total Omzet", Width = 160, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight, Font = FluentTheme.BodyBoldFont } });

        cardProducts.Controls.Add(_gridTopProducts);
        _gridTopProducts.BringToFront();

        // Control order inside scrollContainer
        pnlHeader.BringToFront();
        filterCard.BringToFront();
        sp1.BringToFront();
        metricsGrid.BringToFront();
        sp2.BringToFront();
        splitRow.BringToFront();
        sp3.BringToFront();
        cardProducts.BringToFront();
    }

    private Control CreateReportMetricCard(string title, out Label valueLabel, string initialValue, Color valueColor, Color accentColor)
    {
        var card = new ModernPanel
        {
            Dock = DockStyle.Fill,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(12, 10, 12, 10),
            Margin = new Padding(4)
        };

        var accent = new Panel
        {
            Dock = DockStyle.Left,
            Width = 4,
            BackColor = accentColor
        };
        card.Controls.Add(accent);

        var inner = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(10, 0, 0, 0)
        };
        card.Controls.Add(inner);

        var lblT = new Label
        {
            Text = title,
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Top,
            Height = 18
        };
        inner.Controls.Add(lblT);

        valueLabel = new Label
        {
            Text = initialValue,
            Font = FluentTheme.HeadlineLgFont,
            ForeColor = valueColor,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            AutoEllipsis = true
        };
        inner.Controls.Add(valueLabel);
        valueLabel.BringToFront();

        return card;
    }

    public async Task LoadReportDataAsync()
    {
        DateTime selected = _dtpDate.Value.Date;
        var summary = await _reportService.GetDailySummaryAsync(selected);

        _lblRevenue.Text = $"Rp {summary.TotalRevenue:N0}";
        _lblTxCount.Text = $"{summary.TransactionCount} Transaksi";
        _lblAvgTicket.Text = $"Rp {summary.AverageBasketSize:N0}";
        _lblTotalDiscount.Text = $"Total Diskon Diberikan: Rp {summary.TotalDiscount:N0}";
        _lblTotalTax.Text = $"Total PPN (11%): Rp {summary.TotalTax:N0}";
        _lblCashSales.Text = $"Tunai (Cash): Rp {summary.TotalCash:N0}";
        _lblQrisSales.Text = $"QRIS / E-Wallet: Rp {summary.TotalQris:N0}";
        _lblDebitSales.Text = $"Kartu Debit/Kredit: Rp {summary.TotalDebit:N0}";

        var top = (await _reportService.GetTopSellingProductsAsync(selected, selected, 10)).ToList();
        _gridTopProducts.Rows.Clear();
        foreach (var t in top)
        {
            _gridTopProducts.Rows.Add(
                t.ProductSku,
                t.ProductName,
                $"{t.TotalQuantitySold:0.#}",
                $"Rp {t.TotalRevenue:N0}"
            );
        }
    }
}
