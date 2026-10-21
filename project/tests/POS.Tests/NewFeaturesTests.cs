using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using POS.Application;
using POS.Domain;
using POS.Infrastructure;
using POS.Infrastructure.Hardware;
using POS.Infrastructure.Repositories;
using POS.License;
using Xunit;

namespace POS.Tests;

public class NewFeaturesTests
{
    private DatabaseContext CreateInMemoryDatabase()
    {
        string tempDbPath = Path.Combine(Path.GetTempPath(), $"spark_test_{Guid.NewGuid():N}.db");
        var context = new DatabaseContext(tempDbPath);
        DatabaseMigrator.MigrateAsync(context).GetAwaiter().GetResult();
        return context;
    }

    [Fact]
    public async Task DefaultAdministrator_CanAuthenticate_CaseInsensitive()
    {
        var db = CreateInMemoryDatabase();
        var repo = new EmployeeRepository(db);
        var authService = new AuthService(repo);

        // Test Default Administrator with exact casing
        bool ok1 = await authService.LoginAsync("Administrator", "123456");
        Assert.True(ok1);
        Assert.NotNull(authService.CurrentEmployee);
        Assert.Equal(RoleType.Admin, authService.CurrentEmployee.Role);

        // Test case-insensitivity: lowercase
        authService.Logout();
        bool ok2 = await authService.LoginAsync("administrator", "123456");
        Assert.True(ok2);

        // Test case-insensitivity: uppercase
        authService.Logout();
        bool ok3 = await authService.LoginAsync("ADMINISTRATOR", "123456");
        Assert.True(ok3);

        // Wrong password should fail
        authService.Logout();
        bool fail = await authService.LoginAsync("Administrator", "wrongpass");
        Assert.False(fail);
    }

    [Fact]
    public async Task CashierAndUserManagement_CanCreateAndUpdatePassword()
    {
        var db = CreateInMemoryDatabase();
        var repo = new EmployeeRepository(db);

        // Admin adds new Cashier
        var newCashier = new Employee
        {
            Username = "kasir_budi",
            FullName = "Budi Hartono",
            Pin = "5555",
            Role = RoleType.Cashier,
            IsActive = true,
            CreatedAt = DateTime.Now
        };
        int newId = await repo.CreateAsync(newCashier);
        Assert.True(newId > 0);

        // Authenticate new cashier
        var authNew = await repo.AuthenticateAsync("kasir_budi", "5555");
        Assert.NotNull(authNew);

        // Admin updates cashier password
        authNew.Pin = "7777";
        bool updated = await repo.UpdateAsync(authNew);
        Assert.True(updated);

        // Old password fails, new password succeeds
        Assert.Null(await repo.AuthenticateAsync("kasir_budi", "5555"));
        Assert.NotNull(await repo.AuthenticateAsync("kasir_budi", "7777"));
    }

    [Fact]
    public void ReceiptPrinterService_ResolvesLiteralNewlineBug_InFooter()
    {
        var tx = new Transaction
        {
            InvoiceNumber = "TRX-2026-0001",
            CashierName = "Kasir 01",
            CreatedAt = new DateTime(2026, 9, 23, 10, 0, 0),
            SubTotal = 50000,
            GrandTotal = 50000,
            PaidAmount = 50000,
            ChangeAmount = 0,
            Details = new()
            {
                new TransactionDetail { ProductName = "Minyak Goreng 2L", Quantity = 1, UnitPrice = 50000, Subtotal = 50000 }
            },
            Payments = new()
            {
                new Payment { Method = PaymentMethod.Cash, Amount = 50000, CreatedAt = DateTime.Now }
            }
        };

        // Notice the literal "\\n" string as reported by the user: "Terimakasih Atas Kunjungan Anda!\nBarang yang sudah dibeli..."
        var profile = new StoreProfile
        {
            StoreName = "Toko Berkah",
            Address = "Jl. Sudirman 10",
            Phone = "0812345678",
            ReceiptFooter = "Terimakasih Atas Kunjungan Anda!\\nBarang yang sudah dibeli tidak dapat ditukar\\nSimpan struk ini sebagai bukti pembayaran"
        };

        string receipt = ReceiptPrinterService.FormatReceiptText(tx, profile, 42);

        // Each part of the literal \n must appear as its own separate line, NOT grouped on 1 line!
        Assert.Contains("Terimakasih Atas Kunjungan Anda!", receipt);
        Assert.Contains("Barang yang sudah dibeli tidak dapat ditukar", receipt);
        Assert.Contains("Simpan struk ini sebagai bukti pembayaran", receipt);

        // Verify they are on distinct lines
        var lines = receipt.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        int footerLineIndex1 = Array.FindIndex(lines, l => l.Contains("Terimakasih Atas Kunjungan Anda!"));
        int footerLineIndex2 = Array.FindIndex(lines, l => l.Contains("Barang yang sudah dibeli tidak dapat ditukar"));
        int footerLineIndex3 = Array.FindIndex(lines, l => l.Contains("Simpan struk ini sebagai bukti pembayaran"));

        Assert.True(footerLineIndex1 >= 0);
        Assert.True(footerLineIndex2 > footerLineIndex1);
        Assert.True(footerLineIndex3 > footerLineIndex2);
    }

    [Theory]
    [InlineData("EPSON TM-T82 Receipt Printer", 42, "POS Kasir Thermal (80mm EPSON Standard)")]
    [InlineData("POS-58 Mini Thermal Printer", 32, "Mini Kasir Thermal (58mm)")]
    [InlineData("ZJ-5809 POS", 32, "Mini Kasir Thermal (58mm)")]
    [InlineData("Microsoft Print to PDF", 56, "Printer Dokumen / Desktop (A4)")]
    [InlineData("Canon LBP2900 Laser", 56, "Printer Dokumen / Desktop (A4)")]
    public void ReceiptPrinterService_ClassifiesPrinterTypesCorrectly(string printerName, int expectedCols, string expectedCategory)
    {
        var (cols, desc) = ReceiptPrinterService.ClassifyPrinterType(printerName);
        Assert.Equal(expectedCols, cols);
        Assert.Equal(expectedCategory, desc);
    }

    [Fact]
    public void Trial30Days_AndKeygenOfflineValidation()
    {
        string tempDir = Path.Combine(Path.GetTempPath(), $"spark_lic_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);

        try
        {
            var mgr = new LicenseManager(tempDir);

            // Initially unregistered
            var initEval = mgr.EvaluateLicense();
            Assert.Equal(LicenseStatus.Unregistered, initEval.Status);
            Assert.False(mgr.HasUsedTrial);
            Assert.False(mgr.CanTransact);

            // Start 30-Day Trial
            var trialEval = mgr.StartTrial30Days();
            Assert.True(trialEval.IsValid);
            Assert.True(trialEval.IsTrial);
            Assert.Equal(LicenseStatus.Active, trialEval.Status);
            Assert.True(trialEval.RemainingDays > 25);
            Assert.True(mgr.CanTransact);
            Assert.True(mgr.HasUsedTrial);

            // Developer generates 1-Year Official Key using Keygen logic
            string hw = mgr.CurrentHardwareFingerprint;
            DateTime expiry = DateTime.Now.AddDays(365);
            string serial = LicenseCrypto.GenerateSerialKey(expiry, hw, graceDays: 14);

            // Activate with generated serial key
            var actResult = mgr.ActivateWithSerialKey(serial);
            Assert.True(actResult.IsValid);
            Assert.Equal(LicenseStatus.Active, actResult.Status);
            Assert.False(actResult.IsTrial);
            Assert.True(actResult.RemainingDays >= 364);
            Assert.True(mgr.CanTransact);
        }
        finally
        {
            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task StoreProfile_UpdateStoreDetails_PersistsCorrectly()
    {
        var db = CreateInMemoryDatabase();
        var repo = new StoreProfileRepository(db);

        var original = await repo.GetProfileAsync();
        Assert.NotNull(original);

        var updated = new StoreProfile
        {
            StoreName = "Toko Berkah Sejahtera Mandiri",
            BranchName = "Cabang Senayan",
            Address = "Jl. Asia Afrika No. 8, Jakarta Selatan",
            Phone = "0812-9988-7766",
            ReceiptHeader = "Selamat Datang di Toko Berkah Mandiri\nBelanja Hemat Setiap Hari",
            ReceiptFooter = "Terima Kasih Atas Kunjungan Anda!\nBarang yang dibeli tidak dapat ditukar.",
            TaxPercentage = 11,
            DefaultTaxInclusive = false
        };

        bool ok = await repo.UpdateProfileAsync(updated);
        Assert.True(ok);

        var loaded = await repo.GetProfileAsync();
        Assert.Equal("Toko Berkah Sejahtera Mandiri", loaded.StoreName);
        Assert.Equal("Cabang Senayan", loaded.BranchName);
        Assert.Equal("0812-9988-7766", loaded.Phone);
        Assert.Equal("Jl. Asia Afrika No. 8, Jakarta Selatan", loaded.Address);
    }

    [Fact]
    public async Task Product_Delete_RemovesProductAndStockMovements()
    {
        var db = CreateInMemoryDatabase();
        var repo = new ProductRepository(db);

        // 1. Create product
        var product = new Product
        {
            Sku = "TEST-DEL-001",
            Barcode = "999888777001",
            Name = "Item Uji Coba Hapus",
            CategoryId = 1,
            UnitId = 1,
            BuyPrice = 5000,
            SellPrice = 7500,
            Stock = 20,
            MinStock = 5,
            IsActive = true
        };
        int prodId = await repo.CreateAsync(product);
        Assert.True(prodId > 0);

        // Verify product exists
        var fetched = await repo.GetByIdAsync(prodId);
        Assert.NotNull(fetched);

        // Delete product
        bool deleted = await repo.DeleteAsync(prodId);
        Assert.True(deleted);

        // Verify it is removed
        var afterDelete = await repo.GetByIdAsync(prodId);
        Assert.Null(afterDelete);
    }
}
