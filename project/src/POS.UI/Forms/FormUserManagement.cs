using System;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using POS.Application;
using POS.Domain;
using POS.UI.Components;
using POS.UI.Theme;

namespace POS.UI.Forms;

public class FormUserManagement : Form
{
    private readonly IEmployeeRepository _employeeRepo;
    private readonly AuthService _authService;

    private DataGridView _gridUsers = null!;
    private TextBox _txtUsername = null!;
    private TextBox _txtFullName = null!;
    private TextBox _txtPassword = null!;
    private ComboBox _cboRole = null!;
    private CheckBox _chkIsActive = null!;
    private Label _lblStatus = null!;
    private ModernButton _btnSave = null!;
    private ModernButton _btnNew = null!;
    private int? _selectedEmployeeId = null;

    public FormUserManagement(IEmployeeRepository employeeRepo, AuthService authService)
    {
        _employeeRepo = employeeRepo;
        _authService = authService;

        InitializeComponent();
        _ = LoadUsersAsync();
    }

    private void InitializeComponent()
    {
        Text = "Manajemen Pengguna Kasir & Administrator — Spark POS";
        Size = new Size(880, 580);
        MinimumSize = new Size(800, 500);
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        BackColor = FluentTheme.Background;
        Font = FluentTheme.BodyFont;

        var mainPanel = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(16)
        };
        Controls.Add(mainPanel);

        // Header Panel
        var pnlHeader = new ModernPanel
        {
            Dock = DockStyle.Top,
            Height = 60,
            BackColor = FluentTheme.Surface,
            ShowBorder = true,
            BorderColor = FluentTheme.Border,
            Padding = new Padding(16, 10, 16, 10),
            Margin = new Padding(0, 0, 0, 12)
        };
        mainPanel.Controls.Add(pnlHeader);

        var lblTitle = new Label
        {
            Text = "MANAJEMEN PENGGUNA & HAK AKSES",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.PrimaryDark,
            Dock = DockStyle.Top,
            Height = 22
        };
        pnlHeader.Controls.Add(lblTitle);

        var lblSub = new Label
        {
            Text = "Kelola akun Administrator, Supervisor, dan Kasir. Password dan PIN dapat diperbarui kapan saja.",
            Font = FluentTheme.BadgeFont,
            ForeColor = FluentTheme.TextSecondary,
            Dock = DockStyle.Top,
            Height = 18
        };
        pnlHeader.Controls.Add(lblSub);

        // Split Container: Left DataGridView, Right Edit Panel
        var split = new SplitContainer
        {
            Dock = DockStyle.Fill,
            Orientation = Orientation.Vertical,
            SplitterDistance = 500,
            IsSplitterFixed = true,
            Padding = new Padding(0, 8, 0, 0)
        };
        mainPanel.Controls.Add(split);
        split.BringToFront();

        // Left: Users Grid
        _gridUsers = new DataGridView
        {
            Dock = DockStyle.Fill,
            BackgroundColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            MultiSelect = false,
            ReadOnly = true,
            AllowUserToAddRows = false,
            RowHeadersVisible = false,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
            Font = FluentTheme.SubheadFont
        };

        _gridUsers.Columns.Add("Id", "ID");
        _gridUsers.Columns["Id"]!.Visible = false;
        _gridUsers.Columns.Add("Username", "Username");
        _gridUsers.Columns.Add("FullName", "Nama Lengkap");
        _gridUsers.Columns.Add("Role", "Peran / Akses");
        _gridUsers.Columns.Add("IsActive", "Status");

        _gridUsers.SelectionChanged += (s, e) => OnUserSelected();
        split.Panel1.Controls.Add(_gridUsers);

        // Right: Edit Form Card
        var pnlEdit = new ModernPanel
        {
            Dock = DockStyle.Fill,
            BackColor = FluentTheme.Surface,
            ShowBorder = true,
            BorderColor = FluentTheme.Border,
            Padding = new Padding(16)
        };
        split.Panel2.Controls.Add(pnlEdit);

        var lblFormTitle = new Label
        {
            Text = "Detail Akun Pengguna",
            Font = FluentTheme.HeadlineFont,
            ForeColor = FluentTheme.TextPrimary,
            Dock = DockStyle.Top,
            Height = 26
        };
        pnlEdit.Controls.Add(lblFormTitle);

        var pnlFormContent = new Panel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(0, 8, 0, 0)
        };
        pnlEdit.Controls.Add(pnlFormContent);
        pnlFormContent.BringToFront();

        int y = 4;
        var lblU = new Label { Text = "Username:", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Location = new Point(0, y), AutoSize = true };
        pnlFormContent.Controls.Add(lblU);
        y += 20;

        _txtUsername = new TextBox { Font = FluentTheme.SubheadFont, Location = new Point(0, y), Size = new Size(310, 30) };
        pnlFormContent.Controls.Add(_txtUsername);
        y += 36;

        var lblF = new Label { Text = "Nama Lengkap:", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Location = new Point(0, y), AutoSize = true };
        pnlFormContent.Controls.Add(lblF);
        y += 20;

        _txtFullName = new TextBox { Font = FluentTheme.SubheadFont, Location = new Point(0, y), Size = new Size(310, 30) };
        pnlFormContent.Controls.Add(_txtFullName);
        y += 36;

        var lblP = new Label { Text = "Password / PIN:", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Location = new Point(0, y), AutoSize = true };
        pnlFormContent.Controls.Add(lblP);
        y += 20;

        _txtPassword = new TextBox { Font = FluentTheme.SubheadFont, Location = new Point(0, y), Size = new Size(310, 30) };
        pnlFormContent.Controls.Add(_txtPassword);
        y += 36;

        var lblR = new Label { Text = "Hak Akses / Peran:", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.TextSecondary, Location = new Point(0, y), AutoSize = true };
        pnlFormContent.Controls.Add(lblR);
        y += 20;

        _cboRole = new ComboBox { Font = FluentTheme.SubheadFont, Location = new Point(0, y), Size = new Size(310, 30), DropDownStyle = ComboBoxStyle.DropDownList };
        _cboRole.Items.Add("Kasir (Hanya Penjualan & Shift)");
        _cboRole.Items.Add("Supervisor (Otorisasi & Laporan)");
        _cboRole.Items.Add("Administrator (Akses Penuh)");
        _cboRole.SelectedIndex = 0;
        pnlFormContent.Controls.Add(_cboRole);
        y += 36;

        _chkIsActive = new CheckBox { Text = "Akun Aktif (Bisa Login)", Font = FluentTheme.SubheadFont, Location = new Point(0, y), AutoSize = true, Checked = true };
        pnlFormContent.Controls.Add(_chkIsActive);
        y += 32;

        _lblStatus = new Label { Text = "", Font = FluentTheme.BadgeFont, ForeColor = FluentTheme.Secondary, Location = new Point(0, y), Size = new Size(310, 20) };
        pnlFormContent.Controls.Add(_lblStatus);

        // Action Buttons Row
        var pnlButtons = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 44
        };
        pnlEdit.Controls.Add(pnlButtons);

        _btnNew = new ModernButton
        {
            Text = "+ User Baru",
            Size = new Size(100, 38),
            Dock = DockStyle.Left,
            NormalBackColor = FluentTheme.SurfaceHigh,
            NormalForeColor = FluentTheme.TextPrimary,
            ShowBorder = true,
            Font = FluentTheme.BadgeFont
        };
        _btnNew.Click += (s, e) => ClearForNew();
        pnlButtons.Controls.Add(_btnNew);

        _btnSave = new ModernButton
        {
            Text = "Simpan User",
            Size = new Size(200, 38),
            Dock = DockStyle.Right,
            NormalBackColor = FluentTheme.Primary,
            NormalForeColor = Color.White,
            Font = FluentTheme.SubheadFont
        };
        _btnSave.Click += async (s, e) => await SaveUserAsync();
        pnlButtons.Controls.Add(_btnSave);
    }

    private async Task LoadUsersAsync()
    {
        _gridUsers.Rows.Clear();
        var users = await _employeeRepo.GetAllAsync();

        foreach (var u in users)
        {
            string roleStr = u.Role switch
            {
                RoleType.Admin => "Administrator",
                RoleType.Supervisor => "Supervisor",
                _ => "Kasir"
            };

            string statusStr = u.IsActive ? "Aktif" : "Nonaktif";
            _gridUsers.Rows.Add(u.Id, u.Username, u.FullName, roleStr, statusStr);
        }

        if (_gridUsers.Rows.Count > 0)
        {
            _gridUsers.Rows[0].Selected = true;
            OnUserSelected();
        }
    }

    private void OnUserSelected()
    {
        if (_gridUsers.SelectedRows.Count == 0) return;

        var row = _gridUsers.SelectedRows[0];
        if (int.TryParse(row.Cells["Id"].Value?.ToString(), out int id))
        {
            _selectedEmployeeId = id;
            _ = PopulateFormAsync(id);
        }
    }

    private async Task PopulateFormAsync(int id)
    {
        var emp = await _employeeRepo.GetByIdAsync(id);
        if (emp != null)
        {
            _txtUsername.Text = emp.Username;
            _txtFullName.Text = emp.FullName;
            _txtPassword.Text = emp.Pin;
            _chkIsActive.Checked = emp.IsActive;

            _cboRole.SelectedIndex = emp.Role switch
            {
                RoleType.Admin => 2,
                RoleType.Supervisor => 1,
                _ => 0
            };

            _lblStatus.Text = $"Mengedit akun: {emp.Username}";
            _lblStatus.ForeColor = FluentTheme.TextSecondary;
            _btnSave.Text = "Simpan Perubahan";
        }
    }

    private void ClearForNew()
    {
        _selectedEmployeeId = null;
        _txtUsername.Text = "";
        _txtFullName.Text = "";
        _txtPassword.Text = "";
        _cboRole.SelectedIndex = 0;
        _chkIsActive.Checked = true;
        _lblStatus.Text = "Mode: Tambah Pengguna Baru";
        _lblStatus.ForeColor = FluentTheme.Secondary;
        _btnSave.Text = "Tambah Pengguna";
        _txtUsername.Focus();
    }

    private async Task SaveUserAsync()
    {
        string username = _txtUsername.Text.Trim();
        string fullName = _txtFullName.Text.Trim();
        string pin = _txtPassword.Text.Trim();

        if (string.IsNullOrWhiteSpace(username))
        {
            MessageBox.Show("Username tidak boleh kosong.", "Validasi", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _txtUsername.Focus();
            return;
        }

        if (string.IsNullOrWhiteSpace(fullName))
        {
            MessageBox.Show("Nama lengkap tidak boleh kosong.", "Validasi", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _txtFullName.Focus();
            return;
        }

        if (string.IsNullOrWhiteSpace(pin))
        {
            MessageBox.Show("Password/PIN tidak boleh kosong.", "Validasi", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _txtPassword.Focus();
            return;
        }

        RoleType role = _cboRole.SelectedIndex switch
        {
            2 => RoleType.Admin,
            1 => RoleType.Supervisor,
            _ => RoleType.Cashier
        };

        if (_selectedEmployeeId.HasValue)
        {
            // Update existing user
            var emp = await _employeeRepo.GetByIdAsync(_selectedEmployeeId.Value);
            if (emp != null)
            {
                emp.Username = username;
                emp.FullName = fullName;
                emp.Pin = pin;
                emp.Role = role;
                emp.IsActive = _chkIsActive.Checked;

                bool ok = await _employeeRepo.UpdateAsync(emp);
                if (ok)
                {
                    MessageBox.Show($"Akun '{username}' berhasil diperbarui.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    await LoadUsersAsync();
                }
            }
        }
        else
        {
            // Check if username already exists
            var existing = await _employeeRepo.GetByUsernameAsync(username);
            if (existing != null)
            {
                MessageBox.Show($"Username '{username}' sudah terdaftar! Gunakan username lain.", "Peringatan", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                _txtUsername.Focus();
                return;
            }

            var newEmp = new Employee
            {
                Username = username,
                FullName = fullName,
                Pin = pin,
                Role = role,
                IsActive = _chkIsActive.Checked,
                CreatedAt = DateTime.Now
            };

            await _employeeRepo.CreateAsync(newEmp);
            MessageBox.Show($"Akun '{username}' berhasil ditambahkan.", "Sukses", MessageBoxButtons.OK, MessageBoxIcon.Information);
            await LoadUsersAsync();
        }
    }
}
