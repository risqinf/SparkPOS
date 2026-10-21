using System;
using System.Drawing;
using System.Drawing.Printing;
using System.Linq;
using System.Windows.Forms;
using POS.Domain;
using POS.Infrastructure.Hardware;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Forms;

public class FormReceiptDialog : Form
{
    private readonly Transaction _transaction;
    private readonly StoreProfile _storeProfile;
    private string _receiptText;
    private int _paperColumns = 42; // Default: 80mm EPSON Standard
    private TextBox _txtReceipt = null!;
    private ModernButton _btn58mm = null!;
    private ModernButton _btn80mm = null!;
    private ModernButton _btnA4 = null!;
    private ComboBox _cboPrinters = null!;
    private Label _lblPrinterStatus = null!;

    public FormReceiptDialog(Transaction transaction, StoreProfile storeProfile)
    {
        _transaction = transaction;
        _storeProfile = storeProfile;
        _receiptText = ReceiptPrinterService.FormatReceiptText(transaction, storeProfile, _paperColumns);

        InitializeComponent();
        DetectAndPopulatePrinters();
    }

    private void InitializeComponent()
    {
        Text = $"Bukti Transaksi — {_transaction.InvoiceNumber}";
        Size = new Size(540, 780);
        MinimumSize = new Size(480, 640);
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;
        KeyPreview = true;

        var mainPanel = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(16)
        };
        Controls.Add(mainPanel);

        // Header Status Banner (Payment Success)
        var headerBanner = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 42,
            BackColor = FluentTheme.SecondaryContainer,
            ShowBorder = true,
            BorderColor = FluentTheme.Secondary,
            Padding = new Padding(12, 6, 12, 6),
            Margin = new Padding(0, 0, 0, 6)
        };
        mainPanel.Controls.Add(headerBanner);

        var lblStatus = new Label
        {
            Text = $"✓ Pembayaran Berhasil — Kembalian: Rp {_transaction.ChangeAmount:N0}",
            Font = FluentTheme.BodyBoldFont,
            ForeColor = FluentTheme.Secondary,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft
        };
        headerBanner.Controls.Add(lblStatus);

        // Hardware Printer Detection & Selection Card
        var pnlPrinterSelection = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 74,
            BackColor = FluentTheme.Surface,
            ShowBorder = true,
            BorderColor = FluentTheme.Border,
            Padding = new Padding(12, 8, 12, 8),
            Margin = new Padding(0, 6, 0, 6)
        };
        mainPanel.Controls.Add(pnlPrinterSelection);

        _lblPrinterStatus = new Label
        {
            Text = "Mendeteksi printer sistem...",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 22,
            TextAlign = ContentAlignment.MiddleLeft
        };
        pnlPrinterSelection.Controls.Add(_lblPrinterStatus);

        var cboRow = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(0, 4, 0, 0)
        };
        pnlPrinterSelection.Controls.Add(cboRow);

        var lblCboTitle = new Label
        {
            Text = "Printer:",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Left,
            Width = 55,
            TextAlign = ContentAlignment.MiddleLeft
        };
        cboRow.Controls.Add(lblCboTitle);

        var btnRefreshPrinters = new ModernButton
        {
            Text = "Pindai",
            Dock = DockStyle.Right,
            Width = 72,
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont
        };
        btnRefreshPrinters.Click += (s, e) => DetectAndPopulatePrinters();
        cboRow.Controls.Add(btnRefreshPrinters);

        _cboPrinters = new ComboBox
        {
            Dock = DockStyle.Fill,
            DropDownStyle = ComboBoxStyle.DropDownList,
            Font = FluentTheme.SubheadFont,
            BackColor = Color.White
        };
        _cboPrinters.SelectedIndexChanged += OnPrinterSelectionChanged;
        cboRow.Controls.Add(_cboPrinters);
        _cboPrinters.BringToFront();

        // Printer Paper Format Ribbon
        var formatRibbon = new Panel
        {
            Dock = DockStyle.Top,
            Height = 38,
            Padding = new Padding(0, 6, 0, 4)
        };
        mainPanel.Controls.Add(formatRibbon);

        var formatFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            WrapContents = false
        };
        formatRibbon.Controls.Add(formatFlow);

        var lblFormatTitle = new Label
        {
            Text = "Ukuran Kertas:",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            AutoSize = true,
            Margin = new Padding(0, 6, 8, 0)
        };
        formatFlow.Controls.Add(lblFormatTitle);

        _btn58mm = new ModernButton
        {
            Text = "58mm (Mini)",
            Size = new Size(115, 28),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 6, 0)
        };
        _btn58mm.Click += (s, e) => SetPaperFormat(32, _btn58mm);
        formatFlow.Controls.Add(_btn58mm);

        _btn80mm = new ModernButton
        {
            Text = "80mm (Epson POS)",
            Size = new Size(135, 28),
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            ShowBorder = false,
            Font = FluentTheme.BadgeFont,
            Margin = new Padding(0, 0, 6, 0)
        };
        _btn80mm.Click += (s, e) => SetPaperFormat(42, _btn80mm);
        formatFlow.Controls.Add(_btn80mm);

        _btnA4 = new ModernButton
        {
            Text = "A4 / Desktop",
            Size = new Size(115, 28),
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont
        };
        _btnA4.Click += (s, e) => SetPaperFormat(56, _btnA4);
        formatFlow.Controls.Add(_btnA4);

        // Bottom Action Buttons
        var bottomActionPanel = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 52,
            Padding = new Padding(0, 8, 0, 0)
        };
        mainPanel.Controls.Add(bottomActionPanel);

        var btnClose = new ModernButton
        {
            Text = "Transaksi Baru [ENTER]",
            ShortcutKey = "ENTER",
            Dock = DockStyle.Right,
            Width = 210,
            NormalBackColor = FluentTheme.Secondary,
            HoverBackColor = FluentTheme.SecondaryHover,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont
        };
        btnClose.Click += (s, e) => { DialogResult = DialogResult.OK; Close(); };
        bottomActionPanel.Controls.Add(btnClose);

        var btnPrint = new ModernButton
        {
            Text = "Cetak Struk",
            ShortcutKey = "P",
            Dock = DockStyle.Left,
            Width = 180,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont
        };
        btnPrint.Click += (s, e) => PrintReceipt();
        bottomActionPanel.Controls.Add(btnPrint);

        // Center Simulated Thermal Paper Receipt
        var receiptPaperCard = new ModernPanel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.White,
            ShowBorder = true,
            BorderColor = FluentTheme.BorderDark,
            Padding = new Padding(14)
        };
        mainPanel.Controls.Add(receiptPaperCard);
        receiptPaperCard.BringToFront();

        _txtReceipt = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            BackColor = Color.White,
            ForeColor = ColorTranslator.FromHtml("#1E293B"),
            BorderStyle = BorderStyle.None,
            Font = new Font("Consolas", 10f, FontStyle.Regular),
            ScrollBars = ScrollBars.Vertical,
            Text = _receiptText
        };
        receiptPaperCard.Controls.Add(_txtReceipt);

        KeyDown += (s, e) =>
        {
            if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Escape)
            {
                DialogResult = DialogResult.OK;
                Close();
            }
            else if (e.KeyCode == Keys.P && e.Control)
            {
                PrintReceipt();
            }
        };
    }

    private void DetectAndPopulatePrinters()
    {
        _cboPrinters.Items.Clear();

        var installedPrinters = PrinterSettings.InstalledPrinters.Cast<string>().ToList();

        if (installedPrinters.Count == 0)
        {
            _cboPrinters.Items.Add("(Tidak ada printer terpasang)");
            _cboPrinters.SelectedIndex = 0;
            _lblPrinterStatus.Text = "Tidak ditemukan printer di sistem. Struk dapat disalin ke clipboard.";
            _lblPrinterStatus.ForeColor = FluentTheme.Danger;
            return;
        }

        string defaultPrinter = new PrinterSettings().PrinterName;
        int selectedIndex = 0;
        int posIndex = -1;

        for (int i = 0; i < installedPrinters.Count; i++)
        {
            string pName = installedPrinters[i];
            var (cols, typeDesc) = ReceiptPrinterService.ClassifyPrinterType(pName);
            _cboPrinters.Items.Add($"{pName} — [{typeDesc}]");

            // Prioritize dedicated POS receipt printers (TM-T, 58mm, 80mm) over PDF/desktop
            if (cols == 32 || cols == 42)
            {
                if (posIndex == -1 && (pName.ToLowerInvariant().Contains("tm-") || pName.ToLowerInvariant().Contains("pos") || pName.ToLowerInvariant().Contains("receipt")))
                {
                    posIndex = i;
                }
            }

            if (string.Equals(pName, defaultPrinter, StringComparison.OrdinalIgnoreCase))
            {
                selectedIndex = i;
            }
        }

        // If a specialized POS printer was detected, auto-select it; otherwise fallback to default Windows printer
        if (posIndex >= 0)
        {
            _cboPrinters.SelectedIndex = posIndex;
        }
        else
        {
            _cboPrinters.SelectedIndex = Math.Clamp(selectedIndex, 0, _cboPrinters.Items.Count - 1);
        }

        UpdatePrinterStatus();
    }

    private void OnPrinterSelectionChanged(object? sender, EventArgs e)
    {
        if (_cboPrinters.SelectedIndex < 0) return;

        string selectedText = _cboPrinters.SelectedItem?.ToString() ?? string.Empty;
        string printerName = selectedText.Split(" — [")[0].Trim();

        var (cols, typeDesc) = ReceiptPrinterService.ClassifyPrinterType(printerName);

        // Auto-adjust paper width to match detected printer type
        if (cols == 32)
        {
            SetPaperFormat(32, _btn58mm);
        }
        else if (cols == 56)
        {
            SetPaperFormat(56, _btnA4);
        }
        else
        {
            SetPaperFormat(42, _btn80mm);
        }

        UpdatePrinterStatus();
    }

    private void UpdatePrinterStatus()
    {
        if (_cboPrinters.SelectedIndex < 0 || _cboPrinters.Items.Count == 0) return;

        string selectedText = _cboPrinters.SelectedItem?.ToString() ?? string.Empty;
        if (selectedText.StartsWith("(")) return;

        string printerName = selectedText.Split(" — [")[0].Trim();
        var (cols, typeDesc) = ReceiptPrinterService.ClassifyPrinterType(printerName);

        _lblPrinterStatus.Text = $"● Terhubung: {printerName} ({typeDesc}) — Siap Cetak";
        _lblPrinterStatus.ForeColor = FluentTheme.Secondary;
    }

    private void SetPaperFormat(int columns, ModernButton activeBtn)
    {
        _paperColumns = columns;
        _receiptText = ReceiptPrinterService.FormatReceiptText(_transaction, _storeProfile, columns);
        _txtReceipt.Text = _receiptText;

        ModernButton[] allBtns = { _btn58mm, _btn80mm, _btnA4 };
        foreach (var b in allBtns)
        {
            bool isCurrent = (b == activeBtn);
            b.NormalBackColor = isCurrent ? FluentTheme.Primary : FluentTheme.SurfaceHigh;
            b.NormalForeColor = isCurrent ? Color.White : FluentTheme.TextPrimary;
            b.ShowBorder = !isCurrent;
            b.Invalidate();
        }
    }

    private void PrintReceipt()
    {
        try
        {
            string selectedText = _cboPrinters.SelectedItem?.ToString() ?? string.Empty;
            string printerName = selectedText.Contains(" — [") ? selectedText.Split(" — [")[0].Trim() : selectedText;

            using var printDoc = new PrintDocument();
            printDoc.DocumentName = $"Struk_{_transaction.InvoiceNumber}";

            if (!string.IsNullOrWhiteSpace(printerName) && !printerName.StartsWith("("))
            {
                printDoc.PrinterSettings.PrinterName = printerName;
            }

            printDoc.PrintPage += (s, ev) =>
            {
                float fontSize = _paperColumns switch
                {
                    <= 32 => 7.5f,
                    <= 44 => 8.5f,
                    _ => 9.5f
                };

                using var font = new Font("Consolas", fontSize, FontStyle.Regular);
                using var brush = new SolidBrush(Color.Black);

                float yPos = 10;
                float leftMargin = _paperColumns switch
                {
                    <= 32 => 6,
                    <= 44 => 10,
                    _ => 25
                };

                var lines = _receiptText.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);

                foreach (var line in lines)
                {
                    ev.Graphics?.DrawString(line, font, brush, leftMargin, yPos);
                    yPos += font.GetHeight(ev.Graphics!);
                }
            };

            // If selected printer is valid, print directly
            if (printDoc.PrinterSettings.IsValid)
            {
                printDoc.Print();
                MessageBox.Show($"Perintah cetak struk berhasil dikirim ke:\n{printDoc.PrinterSettings.PrinterName}", 
                    "Cetak Struk Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            else
            {
                // Fallback to manual selection dialog
                using var dlg = new PrintDialog { Document = printDoc, UseEXDialog = true };
                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    printDoc.Print();
                    MessageBox.Show("Perintah cetak struk berhasil dikirim ke printer.", "Cetak Struk", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Gagal mengirim ke printer: {ex.Message}\n\nTeks struk telah disalin ke clipboard.", "Info Printer", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            Clipboard.SetText(_receiptText);
        }
    }
}
