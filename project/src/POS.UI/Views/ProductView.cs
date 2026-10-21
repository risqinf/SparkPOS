using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Domain;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Views;

public class ProductView : UserControl
{
    private readonly IProductRepository _productRepo;
    private readonly ICategoryRepository _categoryRepo;

    // Top KPI Metrics
    private Label _lblTotalSku = null!;
    private Label _lblLowStockCount = null!;
    private Label _lblZeroStockCount = null!;
    private Label _lblTotalHpp = null!;

    // Search & Filter Ribbon
    private TextBox _txtSearch = null!;
    private FlowLayoutPanel _categoryFilterFlow = null!;
    private ModernButton _btnFilterLow = null!;
    private ModernButton _btnDeleteProduct = null!;

    // Main Workstation
    private DataGridView _gridProducts = null!;

    // Right Side Detail Panel
    private Label _lblDetailStatusBadge = null!;
    private PictureBox _picSelectedProduct = null!;
    private ModernButton _btnDeleteDetail = null!;
    private Label _lblDetailName = null!;
    private Label _lblDetailSku = null!;
    private Label _lblDetailBarcode = null!;
    private Label _lblDetailCategory = null!;
    private Label _lblDetailUnit = null!;
    private Label _lblDetailStock = null!;
    private Label _lblDetailMinStock = null!;
    private Label _lblDetailMargin = null!;
    private DataGridView _gridStockMovements = null!;

    private Product? _selectedProduct;
    private int? _selectedCategoryId = null;
    private bool _filterLowStockOnly = false;

    public ProductView(IProductRepository productRepo, ICategoryRepository categoryRepo)
    {
        _productRepo = productRepo;
        _categoryRepo = categoryRepo;

        InitializeComponent();
        _ = LoadInitialDataAsync();
    }

    private void InitializeComponent()
    {
        Dock = DockStyle.Fill;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;

        var outerContainer = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(14)
        };
        Controls.Add(outerContainer);

        // ================= 1. TOP METRICS BENTO STRIP =================
        var topMetrics = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 78,
            ColumnCount = 4,
            RowCount = 1,
            Margin = new Padding(0, 0, 0, 10)
        };
        for (int i = 0; i < 4; i++) topMetrics.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25f));
        outerContainer.Controls.Add(topMetrics);

        var card1 = CreateMetricCard("TOTAL SKU AKTIF", out _lblTotalSku, "0 SKU", FluentTheme.PrimaryDark, FluentTheme.Primary);
        topMetrics.Controls.Add(card1, 0, 0);

        var card2 = CreateMetricCard("STOK MENIPIS (≤ MIN)", out _lblLowStockCount, "0 Item", FluentTheme.Tertiary, FluentTheme.Tertiary);
        topMetrics.Controls.Add(card2, 1, 0);

        var card3 = CreateMetricCard("STOK HABIS (0)", out _lblZeroStockCount, "0 Item", FluentTheme.Danger, FluentTheme.Danger);
        topMetrics.Controls.Add(card3, 2, 0);

        var card4 = CreateMetricCard("ESTIMASI NILAI HPP", out _lblTotalHpp, "Rp 0", FluentTheme.Secondary, FluentTheme.Secondary);
        topMetrics.Controls.Add(card4, 3, 0);

        // ================= 2. SEARCH & ACTION RIBBON =================
        var ribbon = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 52,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(8, 6, 8, 6),
            Margin = new Padding(0, 0, 0, 10)
        };
        outerContainer.Controls.Add(ribbon);

        // 2A. Right side action buttons
        var rightActionFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Right,
            AutoSize = true,
            WrapContents = false,
            FlowDirection = FlowDirection.RightToLeft,
            Padding = new Padding(0, 1, 0, 0)
        };
        ribbon.Controls.Add(rightActionFlow);

        var btnAdd = new ModernButton
        {
            Text = "+ Tambah Produk",
            Size = new Size(140, 36),
            NormalBackColor = FluentTheme.Secondary,
            HoverBackColor = FluentTheme.SecondaryHover,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont,
            Margin = new Padding(6, 0, 0, 0)
        };
        btnAdd.Click += async (s, e) => await ShowAddProductModalAsync();
        rightActionFlow.Controls.Add(btnAdd);

        _btnFilterLow = new ModernButton
        {
            Text = "Filter Menipis",
            Size = new Size(120, 36),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.Tertiary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(6, 0, 0, 0)
        };
        _btnFilterLow.Click += async (s, e) =>
        {
            _filterLowStockOnly = !_filterLowStockOnly;
            _btnFilterLow.NormalBackColor = _filterLowStockOnly ? FluentTheme.TertiaryContainer : FluentTheme.SurfaceHigh;
            _btnFilterLow.Invalidate();
            await FilterProductsAsync();
        };
        rightActionFlow.Controls.Add(_btnFilterLow);

        _btnDeleteProduct = new ModernButton
        {
            Text = "Hapus Produk",
            Size = new Size(130, 36),
            NormalBackColor = FluentTheme.Danger,
            HoverBackColor = FluentTheme.DangerHover,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont,
            Margin = new Padding(6, 0, 0, 0),
            Enabled = false
        };
        _btnDeleteProduct.Click += async (s, e) => await DeleteSelectedProductsAsync();
        rightActionFlow.Controls.Add(_btnDeleteProduct);

        // 2B. Left search inputs
        var leftSearchPanel = new Panel
        {
            Dock = DockStyle.Left,
            Width = 295,
            Padding = new Padding(0, 2, 0, 0)
        };
        ribbon.Controls.Add(leftSearchPanel);

        _txtSearch = new TextBox
        {
            Location = new Point(2, 4),
            Size = new Size(215, 30),
            Font = new Font("Segoe UI", 10.5f),
            PlaceholderText = "Cari SKU, Barcode, Nama..."
        };
        _txtSearch.KeyDown += async (s, e) =>
        {
            if (e.KeyCode == Keys.Enter) await FilterProductsAsync();
        };
        leftSearchPanel.Controls.Add(_txtSearch);

        var btnSearch = new ModernButton
        {
            Text = "Cari",
            Location = new Point(222, 3),
            Size = new Size(65, 32),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont
        };
        btnSearch.Click += async (s, e) => await FilterProductsAsync();
        leftSearchPanel.Controls.Add(btnSearch);

        // 2C. Center Category Pills Flow (Dynamically fills all remaining space)
        _categoryFilterFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            WrapContents = false,
            AutoScroll = true,
            Padding = new Padding(6, 3, 6, 0)
        };
        ribbon.Controls.Add(_categoryFilterFlow);
        _categoryFilterFlow.BringToFront();

        // ================= 3. MAIN SPLIT WORKSTATION =================
        var splitLayout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1,
            Padding = new Padding(0, 8, 0, 0)
        };
        splitLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 63f));
        splitLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 37f));
        outerContainer.Controls.Add(splitLayout);
        splitLayout.BringToFront();

        // 3A. LEFT PANEL: DATAGRIDVIEW WITH PRODUCT IMAGE
        var gridCard = new ModernPanel
        {
            Dock = DockStyle.Fill,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(1),
            Margin = new Padding(0, 0, 6, 0)
        };
        splitLayout.Controls.Add(gridCard, 0, 0);

        _gridProducts = new DataGridView
        {
            Dock = DockStyle.Fill,
            RowTemplate = { Height = 54 }
        };
        FluentTheme.ApplyModernGridStyle(_gridProducts);

        var colImg = new DataGridViewImageColumn
        {
            Name = "ColImage",
            HeaderText = "Foto",
            Width = 58,
            ImageLayout = DataGridViewImageCellLayout.Zoom
        };
        _gridProducts.Columns.Add(colImg);

        _gridProducts.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColSku", HeaderText = "SKU", Width = 95 });
        _gridProducts.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColBarcode", HeaderText = "Barcode", Width = 110 });
        _gridProducts.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColName", HeaderText = "Nama Produk", FillWeight = 40, AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
        _gridProducts.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColHpp", HeaderText = "HPP", Width = 90, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight } });
        _gridProducts.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColPrice", HeaderText = "Harga Jual", Width = 95, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight, Font = FluentTheme.BodyBoldFont } });
        _gridProducts.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColStock", HeaderText = "Stok Fisik", Width = 95, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter, Font = FluentTheme.BodyBoldFont } });
        _gridProducts.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColStatus", HeaderText = "Status", Width = 90, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter } });

        _gridProducts.MultiSelect = true;
        _gridProducts.SelectionChanged += async (s, e) => await OnProductSelectedFromGridAsync();
        _gridProducts.KeyDown += async (s, e) =>
        {
            if (e.KeyCode == Keys.Delete)
            {
                await DeleteSelectedProductsAsync();
            }
        };
        gridCard.Controls.Add(_gridProducts);

        // 3B. RIGHT PANEL: PRODUCT DETAIL WORKSTATION (STRUCTURED VERTICAL LAYOUT)
        var rightDetailCard = new ModernPanel
        {
            Dock = DockStyle.Fill,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(14),
            Margin = new Padding(6, 0, 0, 0)
        };
        splitLayout.Controls.Add(rightDetailCard, 1, 0);

        var rightScroll = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true
        };
        rightDetailCard.Controls.Add(rightScroll);

        // Layer 1: Top Status Badge
        _lblDetailStatusBadge = new Label
        {
            Text = "● STATUS STOK: AMAN",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.Secondary,
            Dock = DockStyle.Top,
            Height = 22
        };
        rightScroll.Controls.Add(_lblDetailStatusBadge);

        // Layer 2: Large Framed Product Photo
        _picSelectedProduct = new PictureBox
        {
            Dock = DockStyle.Top,
            Height = 160,
            SizeMode = PictureBoxSizeMode.Zoom,
            BorderStyle = BorderStyle.FixedSingle,
            BackColor = FluentTheme.SurfaceLow
        };
        rightScroll.Controls.Add(_picSelectedProduct);

        // Layer 3: Photo Action Buttons Strip (50% / 50% split)
        var photoBtnTable = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 36,
            ColumnCount = 2,
            RowCount = 1,
            Padding = new Padding(0, 4, 0, 0)
        };
        photoBtnTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 55f));
        photoBtnTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 45f));
        rightScroll.Controls.Add(photoBtnTable);

        var btnChangePhoto = new ModernButton
        {
            Text = "Ganti Foto",
            Dock = DockStyle.Fill,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 4, 0)
        };
        btnChangePhoto.Click += async (s, e) => await ChangeProductPhotoAsync();
        photoBtnTable.Controls.Add(btnChangePhoto, 0, 0);

        var btnResetPhoto = new ModernButton
        {
            Text = "Reset Foto",
            Dock = DockStyle.Fill,
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(4, 0, 0, 0)
        };
        btnResetPhoto.Click += async (s, e) => await ResetProductPhotoAsync();
        photoBtnTable.Controls.Add(btnResetPhoto, 1, 0);

        // Layer 4: Product Name
        _lblDetailName = new Label
        {
            Text = "Pilih produk dari tabel",
            Font = new Font("Segoe UI", 12f, FontStyle.Bold),
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 34,
            TextAlign = ContentAlignment.MiddleLeft,
            AutoEllipsis = true
        };
        rightScroll.Controls.Add(_lblDetailName);

        // Layer 5: SKU, Barcode, Kategori, Satuan (2x2 Grid)
        var metaTable = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 44,
            ColumnCount = 2,
            RowCount = 2
        };
        metaTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        metaTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        rightScroll.Controls.Add(metaTable);

        _lblDetailSku = new Label { Text = "SKU: -", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
        metaTable.Controls.Add(_lblDetailSku, 0, 0);

        _lblDetailBarcode = new Label { Text = "Barcode: -", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
        metaTable.Controls.Add(_lblDetailBarcode, 1, 0);

        _lblDetailCategory = new Label { Text = "Kategori: -", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextMuted, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
        metaTable.Controls.Add(_lblDetailCategory, 0, 1);

        _lblDetailUnit = new Label { Text = "Satuan: Pcs", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextMuted, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
        metaTable.Controls.Add(_lblDetailUnit, 1, 1);

        // Layer 6: 3-Column Stock Bento Box
        var statsTable = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 64,
            ColumnCount = 3,
            RowCount = 1,
            BackColor = FluentTheme.SurfaceLow,
            Margin = new Padding(0, 4, 0, 4)
        };
        statsTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 35f));
        statsTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 32f));
        statsTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33f));
        rightScroll.Controls.Add(statsTable);

        var statPnl1 = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 4, 4, 4) };
        statPnl1.Controls.Add(new Label { Text = "Stok Fisik", Top = 4, Left = 4, Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, AutoSize = true });
        _lblDetailStock = new Label { Text = "0", Top = 22, Left = 4, Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.PrimaryDark, AutoSize = true };
        statPnl1.Controls.Add(_lblDetailStock);
        statsTable.Controls.Add(statPnl1, 0, 0);

        var statPnl2 = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 4, 4, 4) };
        statPnl2.Controls.Add(new Label { Text = "Min Stok", Top = 4, Left = 4, Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, AutoSize = true });
        _lblDetailMinStock = new Label { Text = "0", Top = 22, Left = 4, Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.TextPrimary, AutoSize = true };
        statPnl2.Controls.Add(_lblDetailMinStock);
        statsTable.Controls.Add(statPnl2, 1, 0);

        var statPnl3 = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 4, 4, 4) };
        statPnl3.Controls.Add(new Label { Text = "Margin", Top = 4, Left = 4, Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, AutoSize = true });
        _lblDetailMargin = new Label { Text = "0%", Top = 22, Left = 4, Font = FluentTheme.HeadlineFont, ForeColor = FluentTheme.Secondary, AutoSize = true };
        statPnl3.Controls.Add(_lblDetailMargin);
        statsTable.Controls.Add(statPnl3, 2, 0);

        // Layer 7: Action Buttons Row (50% / 50% split)
        var actionBtnTable = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 44,
            ColumnCount = 3,
            RowCount = 1,
            Padding = new Padding(0, 6, 0, 0)
        };
        actionBtnTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 35f));
        actionBtnTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 35f));
        actionBtnTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 30f));
        rightScroll.Controls.Add(actionBtnTable);

        var btnAdjust = new ModernButton
        {
            Text = "Mutasi Stok",
            Dock = DockStyle.Fill,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont,
            Margin = new Padding(0, 0, 3, 0)
        };
        btnAdjust.Click += async (s, e) => await AdjustStockModalAsync();
        actionBtnTable.Controls.Add(btnAdjust, 0, 0);

        var btnEdit = new ModernButton
        {
            Text = "Edit Produk",
            Dock = DockStyle.Fill,
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.SubheadFont,
            Margin = new Padding(2, 0, 2, 0)
        };
        btnEdit.Click += async (s, e) => await EditSelectedProductModalAsync();
        actionBtnTable.Controls.Add(btnEdit, 1, 0);

        _btnDeleteDetail = new ModernButton
        {
            Text = "Hapus",
            Dock = DockStyle.Fill,
            NormalBackColor = FluentTheme.Danger,
            HoverBackColor = FluentTheme.DangerHover,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont,
            Margin = new Padding(3, 0, 0, 0),
            Enabled = false
        };
        _btnDeleteDetail.Click += async (s, e) => await DeleteSelectedProductsAsync();
        actionBtnTable.Controls.Add(_btnDeleteDetail, 2, 0);

        // Layer 8: Audit Log Header
        var lblAuditHeader = new Label
        {
            Text = "Histori Mutasi Stok (Buku Kartu Stok):",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 28,
            TextAlign = ContentAlignment.BottomLeft
        };
        rightScroll.Controls.Add(lblAuditHeader);

        // Layer 9: Stock Movements DataGridView (Crisp enterprise table layout)
        _gridStockMovements = new DataGridView
        {
            Dock = DockStyle.Fill,
            RowTemplate = { Height = 28 }
        };
        FluentTheme.ApplyModernGridStyle(_gridStockMovements);
        _gridStockMovements.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Waktu", Width = 95 });
        _gridStockMovements.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Keterangan", FillWeight = 50, AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
        _gridStockMovements.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Qty", Width = 60, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight, Font = FluentTheme.BodyBoldFont } });
        _gridStockMovements.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Sisa", Width = 55, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight } });
        rightScroll.Controls.Add(_gridStockMovements);

        // Set explicit control order in rightScroll (Top to Bottom)
        _lblDetailStatusBadge.BringToFront();
        _picSelectedProduct.BringToFront();
        photoBtnTable.BringToFront();
        _lblDetailName.BringToFront();
        metaTable.BringToFront();
        statsTable.BringToFront();
        actionBtnTable.BringToFront();
        lblAuditHeader.BringToFront();
        _gridStockMovements.BringToFront();
    }

    private Control CreateMetricCard(string title, out Label valueLabel, string initialValue, Color valueColor, Color accentColor)
    {
        var card = new ModernPanel
        {
            Dock = DockStyle.Fill,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(12, 8, 12, 8),
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
            Padding = new Padding(8, 0, 0, 0)
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

    public async Task LoadInitialDataAsync()
    {
        await LoadCategoryPillsAsync();
        await FilterProductsAsync();
    }

    private async Task LoadCategoryPillsAsync()
    {
        _categoryFilterFlow.Controls.Clear();

        var btnAll = new ModernButton
        {
            Text = "Semua",
            Size = new Size(74, 30),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 6, 0)
        };
        btnAll.Click += async (s, e) =>
        {
            _selectedCategoryId = null;
            HighlightCategoryPill(btnAll);
            await FilterProductsAsync();
        };
        _categoryFilterFlow.Controls.Add(btnAll);

        var cats = await _categoryRepo.GetAllAsync();
        foreach (var c in cats)
        {
            var btnCat = new ModernButton
            {
                Text = c.Name,
                Size = new Size(125, 30),
                NormalBackColor = FluentTheme.SurfaceHigh,
                NormalForeColor = FluentTheme.TextPrimary,
                ShowBorder = true,
                Font = FluentTheme.BadgeFont,
                Margin = new Padding(0, 0, 6, 0)
            };
            btnCat.Click += async (s, e) =>
            {
                _selectedCategoryId = c.Id;
                HighlightCategoryPill(btnCat);
                await FilterProductsAsync();
            };
            _categoryFilterFlow.Controls.Add(btnCat);
        }
    }

    private void HighlightCategoryPill(ModernButton active)
    {
        foreach (Control c in _categoryFilterFlow.Controls)
        {
            if (c is ModernButton btn)
            {
                bool isCur = (btn == active);
                btn.NormalBackColor = isCur ? FluentTheme.Primary : FluentTheme.SurfaceHigh;
                btn.NormalForeColor = isCur ? Color.White : FluentTheme.TextPrimary;
                btn.ShowBorder = !isCur;
                btn.Invalidate();
            }
        }
    }

    public async Task FilterProductsAsync()
    {
        string q = _txtSearch.Text.Trim();
        var all = (await _productRepo.GetAllAsync(activeOnly: true)).ToList();

        if (!string.IsNullOrEmpty(q))
        {
            all = all.Where(p => p.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                                 p.Sku.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                                 p.Barcode.Contains(q, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (_selectedCategoryId.HasValue)
        {
            all = all.Where(p => p.CategoryId == _selectedCategoryId.Value).ToList();
        }

        if (_filterLowStockOnly)
        {
            all = all.Where(p => p.Stock <= p.MinStock).ToList();
        }

        var fullList = (await _productRepo.GetAllAsync(activeOnly: true)).ToList();
        _lblTotalSku.Text = $"{fullList.Count} SKU";
        int lowCount = fullList.Count(p => p.Stock > 0 && p.Stock <= p.MinStock);
        _lblLowStockCount.Text = $"{lowCount} Item";
        int zeroCount = fullList.Count(p => p.Stock <= 0);
        _lblZeroStockCount.Text = $"{zeroCount} Item";
        decimal totalHpp = fullList.Sum(p => p.BuyPrice * Math.Max(0, p.Stock));
        _lblTotalHpp.Text = $"Rp {totalHpp:N0}";

        _gridProducts.Rows.Clear();
        foreach (var p in all)
        {
            var thumbnail = ProductImageHelper.GetProductImage(p.ImagePath, p.Name, 48, 44);
            string status = p.Stock <= 0 ? "✕ Habis" : p.Stock <= p.MinStock ? "⚠️ Menipis" : "✓ Aman";

            int rowIdx = _gridProducts.Rows.Add(
                thumbnail,
                p.Sku,
                p.Barcode,
                p.Name,
                $"Rp {p.BuyPrice:N0}",
                $"Rp {p.SellPrice:N0}",
                $"{p.Stock:0.#} {p.UnitName}",
                status
            );

            _gridProducts.Rows[rowIdx].Tag = p;

            if (p.Stock <= 0)
                _gridProducts.Rows[rowIdx].Cells["ColStatus"].Style.ForeColor = FluentTheme.Danger;
            else if (p.Stock <= p.MinStock)
                _gridProducts.Rows[rowIdx].Cells["ColStatus"].Style.ForeColor = FluentTheme.Tertiary;
            else
                _gridProducts.Rows[rowIdx].Cells["ColStatus"].Style.ForeColor = FluentTheme.Secondary;
        }

        if (_gridProducts.Rows.Count > 0)
        {
            _gridProducts.Rows[0].Selected = true;
            await ShowProductDetailAsync((Product)_gridProducts.Rows[0].Tag!);
        }
    }

    private async Task OnProductSelectedFromGridAsync()
    {
        bool hasSelection = _gridProducts.SelectedRows.Count > 0;
        _btnDeleteProduct.Enabled = hasSelection;

        if (!hasSelection)
        {
            _btnDeleteDetail.Enabled = false;
            return;
        }

        var p = _gridProducts.SelectedRows[0].Tag as Product;
        if (p != null)
        {
            await ShowProductDetailAsync(p);
            _btnDeleteDetail.Enabled = true;
        }
    }

    private async Task DeleteSelectedProductsAsync()
    {
        var selectedProducts = _gridProducts.SelectedRows
            .Cast<DataGridViewRow>()
            .Select(r => r.Tag as Product)
            .Where(p => p != null)
            .Cast<Product>()
            .ToList();

        if (selectedProducts.Count == 0 && _selectedProduct != null)
        {
            selectedProducts.Add(_selectedProduct);
        }

        if (selectedProducts.Count == 0)
        {
            MessageBox.Show("Silakan pilih produk yang ingin dihapus terlebih dahulu.", "Pilih Produk", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        string confirmMsg = selectedProducts.Count == 1
            ? $"Apakah Anda yakin ingin menghapus produk '{selectedProducts[0].Name}' (SKU: {selectedProducts[0].Sku})?\n\nProduk ini akan dihapus dari katalog."
            : $"Apakah Anda yakin ingin menghapus {selectedProducts.Count} produk terpilih secara permanen?\n\nProduk-produk ini akan dihapus dari katalog.";

        var res = MessageBox.Show(confirmMsg, "Konfirmasi Hapus Produk", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
        if (res != DialogResult.Yes) return;

        int deletedCount = 0;
        foreach (var prod in selectedProducts)
        {
            bool ok = await _productRepo.DeleteAsync(prod.Id);
            if (ok) deletedCount++;
        }

        MessageBox.Show($"Berhasil menghapus {deletedCount} produk dari katalog.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);

        _selectedProduct = null;
        _btnDeleteProduct.Enabled = false;
        _btnDeleteDetail.Enabled = false;

        await FilterProductsAsync();
    }

    private async Task ShowProductDetailAsync(Product p)
    {
        _selectedProduct = p;
        _picSelectedProduct.Image = ProductImageHelper.GetProductImage(p.ImagePath, p.Name, 360, 160);

        _lblDetailName.Text = p.Name;
        _lblDetailSku.Text = $"SKU: {p.Sku}";
        _lblDetailBarcode.Text = $"Barcode: {p.Barcode}";

        var cat = await _categoryRepo.GetByIdAsync(p.CategoryId);
        _lblDetailCategory.Text = $"Kategori: {cat?.Name ?? "-"}";
        _lblDetailUnit.Text = $"Satuan: {p.UnitName}";

        _lblDetailStock.Text = $"{p.Stock:0.#} {p.UnitName}";
        _lblDetailMinStock.Text = $"{p.MinStock:0.#} {p.UnitName}";

        decimal marginPct = p.BuyPrice > 0 ? ((p.SellPrice - p.BuyPrice) / p.BuyPrice) * 100m : 0;
        _lblDetailMargin.Text = $"+{marginPct:0.#}%";

        if (p.Stock <= 0)
        {
            _lblDetailStatusBadge.Text = "● STATUS STOK: HABIS (0)";
            _lblDetailStatusBadge.ForeColor = FluentTheme.Danger;
            _lblDetailStock.ForeColor = FluentTheme.Danger;
        }
        else if (p.Stock <= p.MinStock)
        {
            _lblDetailStatusBadge.Text = "● STATUS STOK: MENIPIS (SEGERA REORDER)";
            _lblDetailStatusBadge.ForeColor = FluentTheme.Tertiary;
            _lblDetailStock.ForeColor = FluentTheme.Tertiary;
        }
        else
        {
            _lblDetailStatusBadge.Text = "● STATUS STOK: AMAN (TERSEDIA)";
            _lblDetailStatusBadge.ForeColor = FluentTheme.Secondary;
            _lblDetailStock.ForeColor = FluentTheme.Secondary;
        }

        // Load Stock Movements into DataGridView
        _gridStockMovements.Rows.Clear();
        var movements = (await _productRepo.GetStockMovementsAsync(p.Id, 25)).ToList();

        foreach (var m in movements)
        {
            string sign = m.Quantity > 0 ? "+" : "";
            int row = _gridStockMovements.Rows.Add(
                m.Timestamp.ToString("dd/MM/yy HH:mm"),
                m.Note,
                $"{sign}{m.Quantity:0.#}",
                $"{m.BalanceAfter:0.#}"
            );

            _gridStockMovements.Rows[row].Cells[2].Style.ForeColor = m.Quantity > 0 ? FluentTheme.Secondary : FluentTheme.Danger;
        }
    }

    private async Task ChangeProductPhotoAsync()
    {
        if (_selectedProduct == null) return;

        using var ofd = new OpenFileDialog
        {
            Title = $"Pilih Foto Kemasan untuk {_selectedProduct.Name}",
            Filter = "File Gambar (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp|Semua File (*.*)|*.*"
        };

        if (ofd.ShowDialog(this) == DialogResult.OK)
        {
            string savedFileName = ProductImageHelper.SaveCustomProductImage(ofd.FileName, _selectedProduct.Sku);
            if (!string.IsNullOrEmpty(savedFileName))
            {
                _selectedProduct.ImagePath = savedFileName;
                await _productRepo.UpdateAsync(_selectedProduct);
                await ShowProductDetailAsync(_selectedProduct);
                await FilterProductsAsync();
                MessageBox.Show("Foto produk berhasil diperbarui!", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
    }

    private async Task ResetProductPhotoAsync()
    {
        if (_selectedProduct == null) return;

        _selectedProduct.ImagePath = "";
        await _productRepo.UpdateAsync(_selectedProduct);
        await ShowProductDetailAsync(_selectedProduct);
        await FilterProductsAsync();
        MessageBox.Show("Foto produk dikembalikan ke artwork default.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private async Task AdjustStockModalAsync()
    {
        if (_selectedProduct == null) return;

        using var prompt = new Form
        {
            Width = 460,
            Height = 360,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            Text = $"Mutasi Stok: {_selectedProduct.Name}",
            StartPosition = FormStartPosition.CenterParent,
            BackColor = FluentTheme.Background,
            MaximizeBox = false,
            MinimizeBox = false,
            Font = FluentTheme.BodyFont
        };

        var pnl = new ModernPanel { Dock = DockStyle.Fill, Margin = new Padding(12), BackColor = FluentTheme.Surface };
        prompt.Controls.Add(pnl);

        var picThumb = new PictureBox
        {
            Location = new Point(16, 14),
            Size = new Size(54, 54),
            SizeMode = PictureBoxSizeMode.Zoom,
            BorderStyle = BorderStyle.FixedSingle,
            Image = ProductImageHelper.GetProductImage(_selectedProduct.ImagePath, _selectedProduct.Name, 54, 54)
        };
        pnl.Controls.Add(picThumb);

        var lblCurStock = new Label
        {
            Text = $"{_selectedProduct.Name}\nStok Saat Ini: {_selectedProduct.Stock:0.#} {_selectedProduct.UnitName}",
            Location = new Point(78, 14),
            Size = new Size(340, 48),
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.PrimaryDark
        };
        pnl.Controls.Add(lblCurStock);

        pnl.Controls.Add(new Label { Text = "Jumlah Perubahan (+ untuk tambah, - untuk kurang):", Top = 76, Left = 16, AutoSize = true, Font = FluentTheme.BadgeFont });
        var txtDelta = new TextBox { Top = 96, Left = 16, Width = 398, Font = new Font("Segoe UI", 12f, FontStyle.Bold), Text = "+10" };
        pnl.Controls.Add(txtDelta);

        var presetRow = new FlowLayoutPanel { Top = 134, Left = 16, Width = 400, Height = 32, WrapContents = false };
        pnl.Controls.Add(presetRow);

        string[] presets = { "+1", "+5", "+10", "+50", "-1", "-5" };
        foreach (var pr in presets)
        {
            var btnPr = new ModernButton
            {
                Text = pr,
                Size = new Size(58, 28),
                NormalBackColor = FluentTheme.SurfaceHigh,
                NormalForeColor = FluentTheme.TextPrimary,
                ShowBorder = true,
                Font = FluentTheme.BadgeFont,
                Margin = new Padding(0, 0, 6, 0)
            };
            btnPr.Click += (s, e) => txtDelta.Text = pr;
            presetRow.Controls.Add(btnPr);
        }

        pnl.Controls.Add(new Label { Text = "Alasan / Jenis Mutasi:", Top = 172, Left = 16, AutoSize = true, Font = FluentTheme.BadgeFont });
        var cmbReason = new ComboBox
        {
            Top = 192,
            Left = 16,
            Width = 398,
            DropDownStyle = ComboBoxStyle.DropDown,
            Font = FluentTheme.BodyFont
        };
        cmbReason.Items.AddRange(new object[] {
            "Penerimaan Barang Supplier",
            "Koreksi Stok Opname Fisik",
            "Barang Rusak / Kadaluwarsa",
            "Retur Penjualan Pelanggan",
            "Pemakaian Internal Toko"
        });
        cmbReason.SelectedIndex = 0;
        pnl.Controls.Add(cmbReason);

        var btnSave = new ModernButton { Text = "Simpan Mutasi", Top = 250, Left = 226, Width = 188, Height = 42, NormalBackColor = FluentTheme.Primary, NormalForeColor = Color.White };
        var btnCancel = new ModernButton { Text = "Batal", Top = 250, Left = 16, Width = 190, Height = 42, NormalBackColor = FluentTheme.SurfaceHigh, NormalForeColor = FluentTheme.TextPrimary, ShowBorder = true };

        btnSave.Click += async (s, e) =>
        {
            if (decimal.TryParse(txtDelta.Text.Replace("+", "").Trim(), out decimal delta))
            {
                var movement = new StockMovement
                {
                    Type = delta >= 0 ? StockMovementType.Adjustment : StockMovementType.Opname,
                    Quantity = delta,
                    Note = cmbReason.Text.Trim(),
                    ReferenceNo = "ADJ-" + DateTime.Now.ToString("MMdd-HHmm")
                };

                await _productRepo.UpdateStockAsync(_selectedProduct.Id, delta, movement);
                prompt.DialogResult = DialogResult.OK;
                prompt.Close();
            }
        };

        btnCancel.Click += (s, e) => { prompt.DialogResult = DialogResult.Cancel; prompt.Close(); };

        pnl.Controls.Add(btnSave);
        pnl.Controls.Add(btnCancel);

        if (prompt.ShowDialog(this) == DialogResult.OK)
        {
            var reloaded = await _productRepo.GetByIdAsync(_selectedProduct.Id);
            if (reloaded != null)
                await ShowProductDetailAsync(reloaded);
            await FilterProductsAsync();
            MessageBox.Show("Stok produk berhasil diperbarui!", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }

    private async Task ShowAddProductModalAsync()
    {
        await ShowProductEditFormAsync(null);
    }

    private async Task EditSelectedProductModalAsync()
    {
        if (_selectedProduct != null)
            await ShowProductEditFormAsync(_selectedProduct);
    }

    private async Task ShowProductEditFormAsync(Product? existing)
    {
        bool isNew = (existing == null);

        using var prompt = new Form
        {
            Width = 560,
            Height = 650,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            Text = isNew ? "Tambah Master Produk & Stok Baru" : $"Edit Produk: {existing?.Name}",
            StartPosition = FormStartPosition.CenterParent,
            BackColor = FluentTheme.Background,
            MaximizeBox = false,
            MinimizeBox = false,
            Font = FluentTheme.BodyFont
        };

        var pnl = new ModernPanel { Dock = DockStyle.Fill, Margin = new Padding(12), BackColor = FluentTheme.Surface };
        prompt.Controls.Add(pnl);

        string currentImagePath = existing?.ImagePath ?? "";

        var picPreview = new PictureBox
        {
            Top = 16,
            Left = 16,
            Size = new Size(130, 110),
            SizeMode = PictureBoxSizeMode.Zoom,
            BorderStyle = BorderStyle.FixedSingle,
            BackColor = FluentTheme.SurfaceLow,
            Image = ProductImageHelper.GetProductImage(currentImagePath, existing?.Name ?? "Produk Baru", 130, 110)
        };
        pnl.Controls.Add(picPreview);

        var lblPhotoTitle = new Label
        {
            Text = "Foto Produk / Stok:",
            Top = 16,
            Left = 160,
            AutoSize = true,
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary
        };
        pnl.Controls.Add(lblPhotoTitle);

        var lblPhotoSub = new Label
        {
            Text = "Unggah foto kemasan asli agar kasir mudah mengenali barang saat transaksi kasir & stok opname.",
            Top = 40,
            Left = 160,
            Size = new Size(350, 40),
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary
        };
        pnl.Controls.Add(lblPhotoSub);

        var btnUploadPhoto = new ModernButton
        {
            Text = "Pilih Foto Komputer...",
            Top = 86,
            Left = 160,
            Size = new Size(190, 34),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.BadgeFont
        };
        pnl.Controls.Add(btnUploadPhoto);

        int y = 140;

        pnl.Controls.Add(new Label { Text = "SKU Produk:", Top = y, Left = 16, AutoSize = true, Font = FluentTheme.BadgeFont });
        var txtSku = new TextBox { Top = y + 18, Left = 16, Width = 240, Text = existing?.Sku ?? $"SKU-{DateTime.Now:MMdd}-{Random.Shared.Next(100, 999)}" };
        pnl.Controls.Add(txtSku);

        pnl.Controls.Add(new Label { Text = "Barcode Scanner:", Top = y, Left = 270, AutoSize = true, Font = FluentTheme.BadgeFont });
        var txtBarcode = new TextBox { Top = y + 18, Left = 270, Width = 240, Text = existing?.Barcode ?? DateTime.Now.ToString("899000000000") };
        pnl.Controls.Add(txtBarcode);

        btnUploadPhoto.Click += (s, e) =>
        {
            using var ofd = new OpenFileDialog { Filter = "File Gambar (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp" };
            if (ofd.ShowDialog(prompt) == DialogResult.OK)
            {
                string saved = ProductImageHelper.SaveCustomProductImage(ofd.FileName, txtSku.Text.Trim());
                if (!string.IsNullOrEmpty(saved))
                {
                    currentImagePath = saved;
                    picPreview.Image = ProductImageHelper.GetProductImage(saved, txtSku.Text.Trim(), 130, 110);
                }
            }
        };

        y += 54;
        pnl.Controls.Add(new Label { Text = "Nama Produk Lengkap:", Top = y, Left = 16, AutoSize = true, Font = FluentTheme.BadgeFont });
        var txtName = new TextBox { Top = y + 18, Left = 16, Width = 494, Text = existing?.Name ?? "" };
        pnl.Controls.Add(txtName);

        y += 54;
        pnl.Controls.Add(new Label { Text = "Satuan / Kemasan:", Top = y, Left = 16, AutoSize = true, Font = FluentTheme.BadgeFont });
        var cmbUnit = new ComboBox { Top = y + 18, Left = 16, Width = 240, DropDownStyle = ComboBoxStyle.DropDown };
        cmbUnit.Items.AddRange(new object[] { "Pcs", "Botol", "Bungkus", "Box / Dus", "Sachet", "Kaleng", "Kg", "Liter", "Pack" });
        cmbUnit.Text = existing?.UnitName ?? "Pcs";
        pnl.Controls.Add(cmbUnit);

        pnl.Controls.Add(new Label { Text = "Kategori Produk:", Top = y, Left = 270, AutoSize = true, Font = FluentTheme.BadgeFont });
        var cmbCat = new ComboBox { Top = y + 18, Left = 270, Width = 240, DropDownStyle = ComboBoxStyle.DropDownList };
        var cats = (await _categoryRepo.GetAllAsync()).ToList();
        foreach (var c in cats) cmbCat.Items.Add(c.Name);
        if (cmbCat.Items.Count > 0) cmbCat.SelectedIndex = 0;
        pnl.Controls.Add(cmbCat);

        y += 54;
        pnl.Controls.Add(new Label { Text = "Harga Beli / HPP (Rp):", Top = y, Left = 16, AutoSize = true, Font = FluentTheme.BadgeFont });
        var txtBuy = new TextBox { Top = y + 18, Left = 16, Width = 240, Text = existing?.BuyPrice.ToString("0") ?? "5000", TextAlign = HorizontalAlignment.Right };
        pnl.Controls.Add(txtBuy);

        pnl.Controls.Add(new Label { Text = "Harga Jual Kasir (Rp):", Top = y, Left = 270, AutoSize = true, Font = FluentTheme.BadgeFont });
        var txtSell = new TextBox { Top = y + 18, Left = 270, Width = 240, Text = existing?.SellPrice.ToString("0") ?? "7500", TextAlign = HorizontalAlignment.Right };
        pnl.Controls.Add(txtSell);

        y += 54;
        pnl.Controls.Add(new Label { Text = "Stok Fisik Tersedia:", Top = y, Left = 16, AutoSize = true, Font = FluentTheme.BadgeFont });
        var txtStock = new TextBox { Top = y + 18, Left = 16, Width = 240, Text = existing?.Stock.ToString("0") ?? "50", TextAlign = HorizontalAlignment.Center };
        pnl.Controls.Add(txtStock);

        pnl.Controls.Add(new Label { Text = "Stok Minimum (Peringatan):", Top = y, Left = 270, AutoSize = true, Font = FluentTheme.BadgeFont });
        var txtMin = new TextBox { Top = y + 18, Left = 270, Width = 240, Text = existing?.MinStock.ToString("0") ?? "10", TextAlign = HorizontalAlignment.Center };
        pnl.Controls.Add(txtMin);

        y += 74;
        var btnSave = new ModernButton { Text = isNew ? "Simpan Produk Baru" : "Simpan Perubahan", Top = y, Left = 270, Width = 240, Height = 44, NormalBackColor = FluentTheme.Secondary, NormalForeColor = Color.White };
        var btnCancel = new ModernButton { Text = "Batal", Top = y, Left = 16, Width = 240, Height = 44, NormalBackColor = FluentTheme.SurfaceHigh, NormalForeColor = FluentTheme.TextPrimary, ShowBorder = true };

        btnSave.Click += async (s, e) =>
        {
            if (string.IsNullOrWhiteSpace(txtName.Text))
            {
                MessageBox.Show("Nama produk wajib diisi.", "Perhatian", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            decimal.TryParse(txtBuy.Text, out decimal buy);
            decimal.TryParse(txtSell.Text, out decimal sell);
            decimal.TryParse(txtStock.Text, out decimal stock);
            decimal.TryParse(txtMin.Text, out decimal minStock);

            int catId = 1;
            if (cmbCat.SelectedIndex >= 0 && cmbCat.SelectedIndex < cats.Count)
                catId = cats[cmbCat.SelectedIndex].Id;

            if (isNew)
            {
                var newProd = new Product
                {
                    Sku = txtSku.Text.Trim(),
                    Barcode = txtBarcode.Text.Trim(),
                    Name = txtName.Text.Trim(),
                    CategoryId = catId,
                    UnitId = 1,
                    UnitName = cmbUnit.Text.Trim(),
                    BuyPrice = buy,
                    SellPrice = sell,
                    Stock = stock,
                    MinStock = minStock,
                    ImagePath = currentImagePath,
                    IsActive = true
                };

                await _productRepo.CreateAsync(newProd);
            }
            else
            {
                existing!.Sku = txtSku.Text.Trim();
                existing.Barcode = txtBarcode.Text.Trim();
                existing.Name = txtName.Text.Trim();
                existing.CategoryId = catId;
                existing.UnitName = cmbUnit.Text.Trim();
                existing.BuyPrice = buy;
                existing.SellPrice = sell;
                existing.Stock = stock;
                existing.MinStock = minStock;
                existing.ImagePath = currentImagePath;

                await _productRepo.UpdateAsync(existing);
            }

            prompt.DialogResult = DialogResult.OK;
            prompt.Close();
        };

        btnCancel.Click += (s, e) => { prompt.DialogResult = DialogResult.Cancel; prompt.Close(); };

        pnl.Controls.Add(btnSave);
        pnl.Controls.Add(btnCancel);

        if (prompt.ShowDialog(this) == DialogResult.OK)
        {
            await FilterProductsAsync();
            MessageBox.Show(isNew ? "Produk baru berhasil ditambahkan!" : "Produk berhasil diperbarui!", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
}
