using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Application;
using POS.Domain;
using POS.Infrastructure.Hardware;
using POS.UI.Components;
using POS.UI.Forms;
using POS.UI.Theme;

namespace POS.UI.Views;

public class PosTerminalView : UserControl
{
    private readonly SalesService _salesService;
    private readonly IProductRepository _productRepo;
    private readonly ICategoryRepository _categoryRepo;
    private readonly IStoreProfileRepository _storeRepo;
    private readonly AuthService _authService;
    private readonly ShiftService _shiftService;

    // Controls
    private TextBox _txtBarcode = null!;
    private FlowLayoutPanel _categoryFlow = null!;
    private FlowLayoutPanel _productFlow = null!;
    private DataGridView _gridCart = null!;
    private Label _lblSubtotal = null!;
    private Label _lblDiscount = null!;
    private Label _lblTax = null!;
    private Label _lblGrandTotal = null!;
    private Label _lblItemCount = null!;
    private ModernButton _btnPay = null!;
    private Label _lblMember = null!;

    public event Action? TransactionCompleted;

    public PosTerminalView(
        SalesService salesService,
        IProductRepository productRepo,
        ICategoryRepository categoryRepo,
        IStoreProfileRepository storeRepo,
        AuthService authService,
        ShiftService shiftService)
    {
        _salesService = salesService;
        _productRepo = productRepo;
        _categoryRepo = categoryRepo;
        _storeRepo = storeRepo;
        _authService = authService;
        _shiftService = shiftService;

        InitializeComponent();
        _ = LoadInitialDataAsync();
    }

    private void InitializeComponent()
    {
        Dock = DockStyle.Fill;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;

        var mainLayout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1,
            Padding = new Padding(12)
        };
        mainLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58f));
        mainLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42f));
        Controls.Add(mainLayout);

        // ================= LEFT COLUMN: CATALOG & BARCODE (58%) =================
        var leftPanel = new Panel { Dock = DockStyle.Fill, Margin = new Padding(0, 0, 8, 0) };
        mainLayout.Controls.Add(leftPanel, 0, 0);

        // Top Barcode Search Panel
        var searchCard = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 94,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(10),
            Margin = new Padding(0, 0, 0, 8)
        };
        leftPanel.Controls.Add(searchCard);

        var topSearchRow = new Panel
        {
            Dock = DockStyle.Top,
            Height = 38
        };
        searchCard.Controls.Add(topSearchRow);

        _txtBarcode = new TextBox
        {
            Dock = DockStyle.Fill,
            Font = new Font("Segoe UI", 12f, FontStyle.Regular),
            PlaceholderText = "Scan barcode scanner atau ketik nama/SKU produk... (Tekan Enter)"
        };
        _txtBarcode.KeyDown += async (s, e) =>
        {
            if (e.KeyCode == Keys.Enter)
            {
                e.Handled = true;
                e.SuppressKeyPress = true;
                await HandleBarcodeScanAsync();
            }
        };
        topSearchRow.Controls.Add(_txtBarcode);

        var btnSearch = new ModernButton
        {
            Text = "Cari",
            Dock = DockStyle.Right,
            Width = 75,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Margin = new Padding(6, 0, 0, 0)
        };
        btnSearch.Click += async (s, e) => await HandleBarcodeScanAsync();
        topSearchRow.Controls.Add(btnSearch);

        // Bottom Search Row: Member & Quick Status
        var bottomSearchRow = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 32
        };
        searchCard.Controls.Add(bottomSearchRow);

        _lblMember = new Label
        {
            Text = "Pelanggan: Umum (Non-Member)",
            Font = FluentTheme.SubheadFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Left,
            TextAlign = ContentAlignment.MiddleLeft,
            AutoSize = true
        };
        bottomSearchRow.Controls.Add(_lblMember);

        var btnSelectMember = new ModernButton
        {
            Text = "Ganti Member",
            ShortcutKey = "F8",
            Dock = DockStyle.Right,
            Width = 140,
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont
        };
        btnSelectMember.Click += (s, e) => ToggleMember();
        bottomSearchRow.Controls.Add(btnSelectMember);

        // Middle Categories Tabs
        _categoryFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 46,
            WrapContents = false,
            AutoScroll = true,
            Padding = new Padding(0, 6, 0, 4)
        };
        leftPanel.Controls.Add(_categoryFlow);

        // Product Tiles Grid
        _productFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            Padding = new Padding(4)
        };
        leftPanel.Controls.Add(_productFlow);
        _productFlow.BringToFront();

        // ================= RIGHT COLUMN: CART & CHECKOUT (42%) =================
        var rightCard = new ModernPanel
        {
            Dock = DockStyle.Fill,
            BackColor = FluentTheme.Surface,
            Padding = new Padding(12),
            Margin = new Padding(8, 0, 0, 0)
        };
        mainLayout.Controls.Add(rightCard, 1, 0);

        // Cart Title & Item Count
        var cartHeader = new Panel { Dock = DockStyle.Top, Height = 36 };
        rightCard.Controls.Add(cartHeader);

        var lblCartTitle = new Label
        {
            Text = "KERANJANG BELANJA",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Left,
            TextAlign = ContentAlignment.MiddleLeft,
            AutoSize = true
        };
        cartHeader.Controls.Add(lblCartTitle);

        _lblItemCount = new Label
        {
            Text = "0 item",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Right,
            TextAlign = ContentAlignment.MiddleRight,
            AutoSize = true
        };
        cartHeader.Controls.Add(_lblItemCount);

        // Bottom Totals & Pay Panel (Docked at Bottom so it NEVER gets pushed off)
        var bottomTotalsPanel = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 305,
            Padding = new Padding(0, 6, 0, 0)
        };
        rightCard.Controls.Add(bottomTotalsPanel);

        // Accelerator strip
        var actionFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 40,
            WrapContents = false
        };
        bottomTotalsPanel.Controls.Add(actionFlow);

        var btnHold = new ModernButton
        {
            Text = "Hold",
            ShortcutKey = "F5",
            Size = new Size(84, 34),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 4, 0)
        };
        btnHold.Click += async (s, e) => await HoldOrderAsync();
        actionFlow.Controls.Add(btnHold);

        var btnRecall = new ModernButton
        {
            Text = "Recall",
            ShortcutKey = "F6",
            Size = new Size(92, 34),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 4, 0)
        };
        btnRecall.Click += async (s, e) => await RecallOrderAsync();
        actionFlow.Controls.Add(btnRecall);

        var btnDiscount = new ModernButton
        {
            Text = "Diskon",
            ShortcutKey = "F7",
            Size = new Size(95, 34),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 4, 0)
        };
        btnDiscount.Click += async (s, e) => await SetOrderDiscountAsync();
        actionFlow.Controls.Add(btnDiscount);

        var btnClear = new ModernButton
        {
            Text = "Hapus",
            ShortcutKey = "DEL",
            Size = new Size(90, 34),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.Danger,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 4, 0)
        };
        btnClear.Click += async (s, e) => await RemoveSelectedCartItemAsync();
        actionFlow.Controls.Add(btnClear);

        // Financial Breakdown Rows
        var breakdownTable = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 84,
            ColumnCount = 2,
            RowCount = 3
        };
        breakdownTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        breakdownTable.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        bottomTotalsPanel.Controls.Add(breakdownTable);

        breakdownTable.Controls.Add(new Label { Text = "Subtotal:", Font = FluentTheme.BodyFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft }, 0, 0);
        _lblSubtotal = new Label { Text = "Rp 0", Font = FluentTheme.BodyBoldFont, ForeColor = FluentTheme.TextPrimary, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleRight };
        breakdownTable.Controls.Add(_lblSubtotal, 1, 0);

        breakdownTable.Controls.Add(new Label { Text = "Diskon Nota:", Font = FluentTheme.BodyFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft }, 0, 1);
        _lblDiscount = new Label { Text = "-Rp 0", Font = FluentTheme.BodyFont, ForeColor = FluentTheme.Danger, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleRight };
        breakdownTable.Controls.Add(_lblDiscount, 1, 1);

        breakdownTable.Controls.Add(new Label { Text = "PPN (11%):", Font = FluentTheme.BodyFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft }, 0, 2);
        _lblTax = new Label { Text = "Rp 0", Font = FluentTheme.BodyFont, ForeColor = FluentTheme.TextSecondary, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleRight };
        breakdownTable.Controls.Add(_lblTax, 1, 2);

        // Display Grand Total Panel
        var grandTotalBox = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 82,
            BackColor = FluentTheme.SurfaceContainer,
            ShowBorder = true,
            BorderColor = FluentTheme.BorderDark,
            Padding = new Padding(12, 6, 12, 6),
            Margin = new Padding(0, 4, 0, 6)
        };
        bottomTotalsPanel.Controls.Add(grandTotalBox);

        var lblGtTitle = new Label
        {
            Text = "TOTAL AKHIR TAGIHAN",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Top,
            Height = 18
        };
        grandTotalBox.Controls.Add(lblGtTitle);

        _lblGrandTotal = new Label
        {
            Text = "Rp 0",
            Font = new Font("Segoe UI", 20f, FontStyle.Bold),
            ForeColor = FluentTheme.Secondary,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft
        };
        grandTotalBox.Controls.Add(_lblGrandTotal);

        // Big Checkout Pay Button
        _btnPay = new ModernButton
        {
            Text = "BAYAR",
            ShortcutKey = "F12",
            Dock = DockStyle.Bottom,
            Height = 52,
            NormalBackColor = FluentTheme.Secondary,
            HoverBackColor = FluentTheme.SecondaryHover,
            NormalForeColor = Color.White,
            Font = FluentTheme.HeadlineLgFont
        };
        _btnPay.Click += async (s, e) => await OpenPaymentModalAsync();
        bottomTotalsPanel.Controls.Add(_btnPay);

        // Cart DataGridView (Fills the remaining space)
        _gridCart = new DataGridView
        {
            Dock = DockStyle.Fill
        };
        FluentTheme.ApplyModernGridStyle(_gridCart);

        _gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColName", HeaderText = "Produk", FillWeight = 42, AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
        _gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColPrice", HeaderText = "Harga", Width = 90, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight } });
        _gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColQty", HeaderText = "Qty", Width = 55, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleCenter, Font = FluentTheme.BodyBoldFont } });
        _gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColDisc", HeaderText = "Disc", Width = 65, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight } });
        _gridCart.Columns.Add(new DataGridViewTextBoxColumn { Name = "ColSubtotal", HeaderText = "Subtotal", Width = 100, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight, Font = FluentTheme.BodyBoldFont } });

        rightCard.Controls.Add(_gridCart);
        _gridCart.BringToFront();
    }

    public async Task LoadInitialDataAsync()
    {
        await LoadCategoriesAsync();
        await LoadProductsAsync();
        await RefreshCartDisplayAsync();
        _txtBarcode.Focus();
    }

    private async Task LoadCategoriesAsync()
    {
        _categoryFlow.Controls.Clear();
        var allBtn = new ModernButton
        {
            Text = "Semua Item",
            Size = new Size(110, 34),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont,
            Margin = new Padding(0, 0, 6, 0)
        };
        allBtn.Click += async (s, e) => await LoadProductsAsync();
        _categoryFlow.Controls.Add(allBtn);

        var categories = await _categoryRepo.GetAllAsync();
        foreach (var cat in categories)
        {
            var btnCat = new ModernButton
            {
                Text = cat.Name,
                Size = new Size(140, 34),
                NormalBackColor = FluentTheme.SurfaceHigh,
                NormalForeColor = FluentTheme.TextPrimary,
                ShowBorder = true,
                Font = FluentTheme.BodyBoldFont,
                Margin = new Padding(0, 0, 6, 0)
            };
            btnCat.Click += async (s, e) => await LoadProductsAsync(cat.Id);
            _categoryFlow.Controls.Add(btnCat);
        }
    }

    public async Task LoadProductsAsync(int? categoryId = null)
    {
        _productFlow.Controls.Clear();
        IEnumerable<Product> prods = categoryId.HasValue
            ? await _productRepo.GetByCategoryAsync(categoryId.Value)
            : await _productRepo.GetAllAsync(activeOnly: true);

        var list = prods.ToList();
        if (list.Count == 0)
        {
            var pnlEmpty = new Panel
            {
                Size = new Size(520, 220),
                Margin = new Padding(24)
            };
            var lblEmptyTitle = new Label
            {
                Text = "Katalog Produk Masih Kosong",
                Font = FluentTheme.HeadlineLgFont,
                ForeColor = FluentTheme.TextPrimary,
                Dock = DockStyle.Top,
                Height = 36,
                TextAlign = ContentAlignment.MiddleCenter
            };
            var lblEmptySub = new Label
            {
                Text = "Aplikasi Spark POS siap digunakan secara 100% FRESH!\n\nSilakan tambahkan produk baru di menu [F3] Produk,\natau buka menu [F5] Panel Admin untuk mengatur toko Anda.",
                Font = FluentTheme.SubheadFont,
                ForeColor = FluentTheme.TextSecondary,
                Dock = DockStyle.Top,
                Height = 70,
                TextAlign = ContentAlignment.MiddleCenter
            };
            pnlEmpty.Controls.Add(lblEmptySub);
            pnlEmpty.Controls.Add(lblEmptyTitle);
            _productFlow.Controls.Add(pnlEmpty);
            return;
        }

        foreach (var p in list)
        {
            var tile = new ProductTileControl(p) { Margin = new Padding(6) };
            tile.ProductSelected += (s, prod) => AddProductToCart(prod);
            _productFlow.Controls.Add(tile);
        }
    }

    private async Task HandleBarcodeScanAsync()
    {
        string code = _txtBarcode.Text.Trim();
        if (string.IsNullOrEmpty(code)) return;

        var prod = await _productRepo.GetByBarcodeOrSkuAsync(code);
        if (prod != null)
        {
            try { System.Media.SystemSounds.Beep.Play(); } catch { }
            AddProductToCart(prod);
            _txtBarcode.Clear();
            _txtBarcode.Focus();
            return;
        }

        // Try fuzzy name search
        var matches = (await _productRepo.SearchAsync(code)).ToList();
        if (matches.Count == 1)
        {
            try { System.Media.SystemSounds.Beep.Play(); } catch { }
            AddProductToCart(matches[0]);
            _txtBarcode.Clear();
            _txtBarcode.Focus();
        }
        else if (matches.Count > 1)
        {
            _productFlow.Controls.Clear();
            foreach (var m in matches)
            {
                var tile = new ProductTileControl(m) { Margin = new Padding(6) };
                tile.ProductSelected += (s, p) => AddProductToCart(p);
                _productFlow.Controls.Add(tile);
            }
        }
        else
        {
            MessageBox.Show($"Produk dengan barcode/kode '{code}' tidak ditemukan di katalog.", "Pencarian Barcode", MessageBoxButtons.OK, MessageBoxIcon.Information);
            _txtBarcode.SelectAll();
            _txtBarcode.Focus();
        }
    }

    private void AddProductToCart(Product p)
    {
        if (p.Stock <= 0)
        {
            var res = MessageBox.Show($"Stok produk '{p.Name}' habis (0). Tetap masukkan ke keranjang?", "Peringatan Stok", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
            if (res != DialogResult.Yes) return;
        }

        _salesService.AddProduct(p, 1);
        _ = RefreshCartDisplayAsync();
    }

    private async Task RefreshCartDisplayAsync()
    {
        _gridCart.Rows.Clear();
        foreach (var item in _salesService.ActiveCart)
        {
            _gridCart.Rows.Add(
                item.ProductName,
                $"Rp {item.UnitPrice:N0}",
                item.Quantity.ToString("0"),
                item.DiscountAmount > 0 ? $"-{item.DiscountAmount:N0}" : "-",
                $"Rp {item.Subtotal:N0}"
            );
            _gridCart.Rows[^1].Tag = item.ProductId;
        }

        var summary = await _salesService.GetCurrentSummaryAsync();
        _lblSubtotal.Text = $"Rp {summary.SubTotal:N0}";
        _lblDiscount.Text = $"-Rp {summary.DiscountOrderAmount:N0}";
        _lblTax.Text = $"Rp {summary.TaxAmount:N0}";
        _lblGrandTotal.Text = $"Rp {summary.GrandTotal:N0}";
        _lblItemCount.Text = $"{summary.TotalItemCount:0} item";

        _btnPay.Enabled = _salesService.ActiveCart.Count > 0;
    }

    private async Task RemoveSelectedCartItemAsync()
    {
        if (_salesService.ActiveCart.Count == 0 || _gridCart.Rows.Count == 0) return;

        DataGridViewRow? targetRow = null;
        if (_gridCart.SelectedRows.Count > 0)
            targetRow = _gridCart.SelectedRows[0];
        else if (_gridCart.CurrentRow != null)
            targetRow = _gridCart.CurrentRow;
        else if (_gridCart.SelectedCells.Count > 0)
            targetRow = _gridCart.Rows[_gridCart.SelectedCells[0].RowIndex];

        if (targetRow?.Tag is int prodId)
        {
            _salesService.RemoveItem(prodId);
            await RefreshCartDisplayAsync();
        }
    }

    private async Task SetOrderDiscountAsync()
    {
        if (_salesService.ActiveCart.Count == 0) return;

        using var dlg = new FormDiscount(_salesService.OrderDiscountPercent, _salesService.OrderDiscountNominal);
        if (dlg.ShowDialog(this) == DialogResult.OK)
        {
            if (dlg.IsPercentage)
            {
                _salesService.OrderDiscountPercent = dlg.DiscountValue;
                _salesService.OrderDiscountNominal = 0;
            }
            else
            {
                _salesService.OrderDiscountNominal = dlg.DiscountValue;
                _salesService.OrderDiscountPercent = 0;
            }
            await RefreshCartDisplayAsync();
        }
    }

    private async Task HoldOrderAsync()
    {
        if (_salesService.ActiveCart.Count == 0)
        {
            MessageBox.Show("Keranjang masih kosong.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        int cashierId = _authService.CurrentEmployee?.Id ?? 1;
        string cashierName = _authService.CurrentEmployee?.FullName ?? "Kasir 01";
        int shiftId = _shiftService.CurrentShift?.Id ?? 1;

        await _salesService.HoldOrderAsync(cashierId, cashierName, shiftId, "Hold Kasir");
        await RefreshCartDisplayAsync();
        MessageBox.Show("Transaksi berhasil di-Hold (disimpan sementara). Gunakan F6 (Recall) untuk memanggil kembali.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private async Task RecallOrderAsync()
    {
        var held = (await _salesService.GetHeldOrdersAsync()).ToList();
        if (held.Count == 0)
        {
            MessageBox.Show("Tidak ada transaksi yang sedang di-Hold.", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        var latest = held.OrderByDescending(h => h.CreatedAt).First();
        await _salesService.RecallOrderAsync(latest.Id);
        await RefreshCartDisplayAsync();
        MessageBox.Show($"Transaksi #{latest.InvoiceNumber} berhasil dipanggil kembali ke keranjang.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void ToggleMember()
    {
        if (_salesService.SelectedCustomerId != null)
        {
            _salesService.SelectedCustomerId = null;
            _salesService.SelectedCustomerName = null;
            _lblMember.Text = "Pelanggan: Umum (Non-Member)";
            _lblMember.ForeColor = FluentTheme.TextSecondary;
            return;
        }

        using var modal = new Form
        {
            Text = "Input Data Pelanggan / Member",
            Size = new Size(460, 230),
            StartPosition = FormStartPosition.CenterParent,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            BackColor = FluentTheme.Background,
            Font = FluentTheme.BodyFont
        };

        var pnl = new ModernPanel
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(12),
            Padding = new Padding(18),
            BackColor = FluentTheme.Surface,
            CornerRadius = 16
        };
        modal.Controls.Add(pnl);

        pnl.Controls.Add(new Label { Text = "Nama Pelanggan atau Nomor HP Member:", Font = FluentTheme.BodyBoldFont, Dock = DockStyle.Top, Height = 28 });
        var txtName = new TextBox { Font = new Font("Segoe UI", 12f), Dock = DockStyle.Top, PlaceholderText = "Ketik nama pelanggan (misal: Bpk. Rian)" };
        pnl.Controls.Add(txtName);

        var btnSubmit = new ModernButton
        {
            Text = "Simpan Pelanggan",
            Dock = DockStyle.Bottom,
            Height = 44,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            CornerRadius = 22
        };
        btnSubmit.Click += (s, e) =>
        {
            string cName = txtName.Text.Trim();
            if (!string.IsNullOrWhiteSpace(cName))
            {
                _salesService.SelectedCustomerId = 1;
                _salesService.SelectedCustomerName = cName;
                _lblMember.Text = $"Pelanggan: {cName}";
                _lblMember.ForeColor = FluentTheme.Secondary;
            }
            modal.DialogResult = DialogResult.OK;
            modal.Close();
        };
        pnl.Controls.Add(btnSubmit);

        modal.ShowDialog(this);
    }

    public async Task OpenPaymentModalAsync()
    {
        if (_salesService.ActiveCart.Count == 0) return;

        if (!_salesService.LicenseManager.CanTransact)
        {
            var lic = _salesService.LicenseManager.EvaluateLicense();
            MessageBox.Show(
                $"Akses Transaksi Terkunci (Lockdown)!\n\n{lic.Message}\n\nSilakan masukkan lisensi resmi di menu [F9] Lisensi.",
                "Sistem Terkunci",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        var summary = await _salesService.GetCurrentSummaryAsync();
        using var dlg = new FormPayment(summary.GrandTotal);

        if (dlg.ShowDialog(this) == DialogResult.OK)
        {
            try
            {
                int cashierId = _authService.CurrentEmployee?.Id ?? 1;
                string cashierName = _authService.CurrentEmployee?.FullName ?? "Kasir 01";
                int shiftId = _shiftService.CurrentShift?.Id ?? 1;

                var tx = await _salesService.CheckoutAsync(
                    cashierId,
                    cashierName,
                    shiftId,
                    dlg.Payments,
                    dlg.PaidAmount,
                    "Transaksi Penjualan POS Kasir");

                var profile = await _storeRepo.GetProfileAsync();

                await RefreshCartDisplayAsync();
                await LoadProductsAsync();

                TransactionCompleted?.Invoke();

                // Open Receipt Dialog with thermal print option
                using var receiptDlg = new FormReceiptDialog(tx, profile);
                receiptDlg.ShowDialog(this);

                FocusBarcode();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Gagal menyelesaikan transaksi: {ex.Message}", "Error Checkout", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    public async Task RefreshAfterSwitchAsync()
    {
        await LoadProductsAsync();
        await RefreshCartDisplayAsync();
    }

    public void FocusBarcode()
    {
        _txtBarcode.Focus();
        _txtBarcode.SelectAll();
    }
}
