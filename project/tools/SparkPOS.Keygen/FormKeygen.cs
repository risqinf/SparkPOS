using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using POS.Domain;
using POS.License;

namespace SparkPOS.Keygen;

public class FormKeygen : Form
{
    private TextBox _txtClientName = null!;
    private TextBox _txtOutletName = null!;
    private TextBox _txtFingerprint = null!;
    private ComboBox _cboDuration = null!;
    private NumericUpDown _numGrace = null!;
    private TextBox _txtContractId = null!;
    private TextBox _txtResultSerial = null!;
    private TextBox _txtLog = null!;

    public FormKeygen()
    {
        InitializeComponent();
    }

    private void InitializeComponent()
    {
        Text = "Spark POS — Developer License Keygen (Khusus Pemilik)";
        Size = new Size(720, 680);
        MinimumSize = new Size(680, 620);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = ColorTranslator.FromHtml("#F8FAFC");
        Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

        var mainPanel = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(20)
        };
        Controls.Add(mainPanel);

        // Header Card
        var pnlHeader = new Panel
        {
            Dock = DockStyle.Top,
            Height = 70,
            BackColor = ColorTranslator.FromHtml("#0F172A"),
            Padding = new Padding(20, 12, 20, 12)
        };
        mainPanel.Controls.Add(pnlHeader);

        var lblHeaderTitle = new Label
        {
            Text = "SPARK POS — GENERATOR LISENSI RESMI",
            Font = new Font("Segoe UI", 13f, FontStyle.Bold),
            ForeColor = Color.White,
            Dock = DockStyle.Top,
            Height = 26
        };
        pnlHeader.Controls.Add(lblHeaderTitle);

        var lblHeaderSub = new Label
        {
            Text = "Aplikasi internal khusus pemilik / developer untuk men-generate Serial Key dan File Lisensi (.lic) offline.",
            Font = new Font("Segoe UI", 9f),
            ForeColor = ColorTranslator.FromHtml("#94A3B8"),
            Dock = DockStyle.Top,
            Height = 20
        };
        pnlHeader.Controls.Add(lblHeaderSub);

        // Form Fields Container
        var pnlForm = new Panel
        {
            Dock = DockStyle.Top,
            Height = 290,
            Padding = new Padding(0, 14, 0, 0)
        };
        mainPanel.Controls.Add(pnlForm);
        pnlForm.BringToFront();

        int y = 8;
        // Row 1: Client Name & Outlet Name
        var lblClient = new Label { Text = "Nama Klien / Toko:", Location = new Point(0, y), AutoSize = true, ForeColor = ColorTranslator.FromHtml("#334155"), Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
        pnlForm.Controls.Add(lblClient);
        var lblOutlet = new Label { Text = "Cabang / Outlet:", Location = new Point(350, y), AutoSize = true, ForeColor = ColorTranslator.FromHtml("#334155"), Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
        pnlForm.Controls.Add(lblOutlet);
        y += 20;

        _txtClientName = new TextBox { Text = "Toko Berkah Jaya", Location = new Point(0, y), Size = new Size(330, 30), Font = new Font("Segoe UI", 10.5f) };
        pnlForm.Controls.Add(_txtClientName);
        _txtOutletName = new TextBox { Text = "Cabang Utama", Location = new Point(350, y), Size = new Size(330, 30), Font = new Font("Segoe UI", 10.5f) };
        pnlForm.Controls.Add(_txtOutletName);
        y += 38;

        // Row 2: Hardware Fingerprint
        var lblHw = new Label { Text = "Hardware Fingerprint Klien (Dari Tab Lisensi PC Kasir):", Location = new Point(0, y), AutoSize = true, ForeColor = ColorTranslator.FromHtml("#334155"), Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
        pnlForm.Controls.Add(lblHw);
        y += 20;

        _txtFingerprint = new TextBox
        {
            Text = HardwareFingerprint.GetCurrentFingerprint(),
            Location = new Point(0, y),
            Size = new Size(490, 30),
            Font = new Font("Consolas", 11.5f, FontStyle.Bold)
        };
        pnlForm.Controls.Add(_txtFingerprint);

        var btnUseThisPc = new Button
        {
            Text = "Fingerprint PC Ini",
            Location = new Point(500, y - 1),
            Size = new Size(180, 32),
            BackColor = ColorTranslator.FromHtml("#E2E8F0"),
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9f)
        };
        btnUseThisPc.Click += (s, e) => _txtFingerprint.Text = HardwareFingerprint.GetCurrentFingerprint();
        pnlForm.Controls.Add(btnUseThisPc);
        y += 38;

        // Row 3: Durasi & Grace Period & Contract ID
        var lblDur = new Label { Text = "Masa Aktif / Durasi:", Location = new Point(0, y), AutoSize = true, ForeColor = ColorTranslator.FromHtml("#334155"), Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
        pnlForm.Controls.Add(lblDur);
        var lblGrace = new Label { Text = "Masa Tenggang (Grace):", Location = new Point(230, y), AutoSize = true, ForeColor = ColorTranslator.FromHtml("#334155"), Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
        pnlForm.Controls.Add(lblGrace);
        var lblCont = new Label { Text = "Nomor Kontrak / Invoice:", Location = new Point(420, y), AutoSize = true, ForeColor = ColorTranslator.FromHtml("#334155"), Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
        pnlForm.Controls.Add(lblCont);
        y += 20;

        _cboDuration = new ComboBox
        {
            Location = new Point(0, y),
            Size = new Size(215, 30),
            DropDownStyle = ComboBoxStyle.DropDownList,
            Font = new Font("Segoe UI", 10f)
        };
        _cboDuration.Items.Add("30 Hari (1 Bulan)");
        _cboDuration.Items.Add("90 Hari (3 Bulan)");
        _cboDuration.Items.Add("180 Hari (6 Bulan)");
        _cboDuration.Items.Add("365 Hari (1 Tahun)");
        _cboDuration.Items.Add("3 Tahun (1095 Hari)");
        _cboDuration.Items.Add("Seumur Hidup (Lifetime)");
        _cboDuration.SelectedIndex = 3; // Default 1 Tahun
        pnlForm.Controls.Add(_cboDuration);

        _numGrace = new NumericUpDown
        {
            Location = new Point(230, y),
            Size = new Size(170, 30),
            Value = 14,
            Minimum = 0,
            Maximum = 60,
            Font = new Font("Segoe UI", 10f)
        };
        pnlForm.Controls.Add(_numGrace);

        _txtContractId = new TextBox
        {
            Location = new Point(420, y),
            Size = new Size(260, 30),
            Text = $"LIC-{DateTime.Now:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}",
            Font = new Font("Segoe UI", 10f)
        };
        pnlForm.Controls.Add(_txtContractId);
        y += 44;

        // Row 4: Generation Action Buttons
        var btnGenSerial = new Button
        {
            Text = "🔑 Generate Serial Key",
            Location = new Point(0, y),
            Size = new Size(330, 42),
            BackColor = ColorTranslator.FromHtml("#0284C7"),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        btnGenSerial.Click += (s, e) => GenerateSerial();
        pnlForm.Controls.Add(btnGenSerial);

        var btnGenFile = new Button
        {
            Text = "💾 Generate & Simpan File .lic",
            Location = new Point(350, y),
            Size = new Size(330, 42),
            BackColor = ColorTranslator.FromHtml("#10B981"),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        btnGenFile.Click += (s, e) => GenerateFileLicense();
        pnlForm.Controls.Add(btnGenFile);

        // Result Container (Bottom)
        var pnlResult = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(0, 10, 0, 0)
        };
        mainPanel.Controls.Add(pnlResult);
        pnlResult.BringToFront();

        var lblRes = new Label
        {
            Text = "HASIL SERIAL KEY (Format: SPARK-XXXX-XXXX-XXXX-XXXX):",
            Dock = DockStyle.Top,
            Height = 22,
            Font = new Font("Segoe UI", 9f, FontStyle.Bold),
            ForeColor = ColorTranslator.FromHtml("#0F172A")
        };
        pnlResult.Controls.Add(lblRes);

        var serialRow = new Panel
        {
            Dock = DockStyle.Top,
            Height = 40
        };
        pnlResult.Controls.Add(serialRow);

        _txtResultSerial = new TextBox
        {
            Dock = DockStyle.Fill,
            Font = new Font("Consolas", 14f, FontStyle.Bold),
            BackColor = Color.White,
            ReadOnly = true,
            PlaceholderText = "Tekan tombol 'Generate Serial Key' di atas"
        };
        serialRow.Controls.Add(_txtResultSerial);

        var btnCopy = new Button
        {
            Text = "📋 Salin",
            Dock = DockStyle.Right,
            Width = 100,
            BackColor = ColorTranslator.FromHtml("#E2E8F0"),
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold)
        };
        btnCopy.Click += (s, e) =>
        {
            if (!string.IsNullOrWhiteSpace(_txtResultSerial.Text))
            {
                Clipboard.SetText(_txtResultSerial.Text.Trim());
                MessageBox.Show("Serial key disalin ke clipboard!", "Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        };
        serialRow.Controls.Add(btnCopy);

        var lblLog = new Label
        {
            Text = "DETAIL LISENSI & VERIFIKASI OFFLINE:",
            Dock = DockStyle.Top,
            Height = 26,
            Font = new Font("Segoe UI", 9f, FontStyle.Bold),
            ForeColor = ColorTranslator.FromHtml("#475569"),
            Padding = new Padding(0, 6, 0, 0)
        };
        pnlResult.Controls.Add(lblLog);
        lblLog.BringToFront();

        _txtLog = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            Font = new Font("Consolas", 9f),
            BackColor = ColorTranslator.FromHtml("#F1F5F9"),
            ForeColor = ColorTranslator.FromHtml("#1E293B"),
            ScrollBars = ScrollBars.Vertical
        };
        pnlResult.Controls.Add(_txtLog);
        _txtLog.BringToFront();
    }

    private (DateTime ExpiryDate, int Days) GetSelectedDuration()
    {
        int days = _cboDuration.SelectedIndex switch
        {
            0 => 30,
            1 => 90,
            2 => 180,
            3 => 365,
            4 => 1095,
            5 => 36500, // 100 years for lifetime
            _ => 365
        };

        return (DateTime.Now.AddDays(days), days);
    }

    private void GenerateSerial()
    {
        string hw = _txtFingerprint.Text.Trim();
        if (string.IsNullOrWhiteSpace(hw))
        {
            MessageBox.Show("Hardware Fingerprint tidak boleh kosong!", "Perhatian", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _txtFingerprint.Focus();
            return;
        }

        var (expiry, days) = GetSelectedDuration();
        int grace = (int)_numGrace.Value;

        string serial = LicenseCrypto.GenerateSerialKey(expiry, hw, grace);
        _txtResultSerial.Text = serial;

        // Perform test validation to confirm signature and hardware binding
        var val = LicenseCrypto.ValidateSerialKey(serial, hw);

        _txtLog.Text =
            $"[SERIAL KEY GENERATED]\r\n" +
            $"------------------------------------------------------\r\n" +
            $"Serial Key     : {serial}\r\n" +
            $"Klien          : {_txtClientName.Text.Trim()} ({_txtOutletName.Text.Trim()})\r\n" +
            $"Kontrak ID     : {_txtContractId.Text.Trim()}\r\n" +
            $"Fingerprint    : {hw}\r\n" +
            $"Tgl Terbit     : {DateTime.Now:dd/MM/yyyy HH:mm}\r\n" +
            $"Tgl Berakhir   : {expiry:dd/MM/yyyy} (Durasi: {days} Hari)\r\n" +
            $"Masa Tenggang  : {grace} Hari\r\n" +
            $"Verifikasi Tes : Status={val.Status}, Valid={val.IsValid}, SisaHari={val.RemainingDays}\r\n" +
            $"------------------------------------------------------\r\n" +
            $"Serial key ini dapat langsung dimasukkan di Spark POS pada komputer target.";
    }

    private void GenerateFileLicense()
    {
        string hw = _txtFingerprint.Text.Trim();
        if (string.IsNullOrWhiteSpace(hw))
        {
            MessageBox.Show("Hardware Fingerprint tidak boleh kosong!", "Perhatian", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _txtFingerprint.Focus();
            return;
        }

        var (expiry, days) = GetSelectedDuration();
        int grace = (int)_numGrace.Value;
        string contract = _txtContractId.Text.Trim();
        string client = _txtClientName.Text.Trim();
        string outlet = _txtOutletName.Text.Trim();

        var payload = new LicensePayload
        {
            ContractId = contract,
            ClientName = client,
            OutletName = outlet,
            HardwareFingerprint = hw,
            IssueDate = DateTime.Now,
            ExpiryDate = expiry,
            GracePeriodDays = grace,
            Features = "STANDARD,OFFLINE_POS,REPORTS,INVENTORY",
            FormatType = "FILE"
        };

        string encryptedContent = LicenseCrypto.GenerateLicenseFileContent(payload);

        using var sfd = new SaveFileDialog
        {
            Filter = "SparkPOS License File (*.lic)|*.lic|All Files (*.*)|*.*",
            FileName = $"SparkPOS_{client.Replace(" ", "_")}.lic",
            Title = "Simpan File Lisensi Spark POS (.lic)"
        };

        if (sfd.ShowDialog(this) == DialogResult.OK)
        {
            File.WriteAllText(sfd.FileName, encryptedContent);

            var val = LicenseCrypto.ValidateLicenseFileContent(encryptedContent, hw);

            _txtLog.Text =
                $"[FILE .LIC GENERATED & SAVED]\r\n" +
                $"------------------------------------------------------\r\n" +
                $"File Lokasi    : {sfd.FileName}\r\n" +
                $"Klien          : {client} ({outlet})\r\n" +
                $"Kontrak ID     : {contract}\r\n" +
                $"Fingerprint    : {hw}\r\n" +
                $"Tgl Berakhir   : {expiry:dd/MM/yyyy} ({days} Hari)\r\n" +
                $"Verifikasi Tes : Status={val.Status}, Valid={val.IsValid}, SisaHari={val.RemainingDays}\r\n" +
                $"------------------------------------------------------\r\n" +
                $"Kirimkan file ini kepada klien untuk diimpor melalui tab Lisensi di Spark POS.";

            MessageBox.Show($"File lisensi berhasil disimpan ke:\n{sfd.FileName}", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
}
