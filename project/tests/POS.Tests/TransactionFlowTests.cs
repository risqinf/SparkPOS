using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using POS.Application;
using POS.Domain;
using POS.Infrastructure;
using POS.Infrastructure.Repositories;
using POS.License;
using Xunit;

namespace POS.Tests;

public class TransactionFlowTests
{
    private (DatabaseContext db, string dir, SalesService sales, ShiftService shift, IProductRepository prodRepo, LicenseManager licManager) CreateTestEnvironment()
    {
        string tempDir = Path.Combine(Path.GetTempPath(), "SparkPOSTest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        string dbPath = Path.Combine(tempDir, "test_pos.db");

        var db = new DatabaseContext(dbPath);
        DatabaseMigrator.MigrateAsync(db).GetAwaiter().GetResult();

        var prodRepo = new ProductRepository(db);
        var txRepo = new TransactionRepository(db);
        var shiftRepo = new ShiftRepository(db);
        var storeRepo = new StoreProfileRepository(db);
        var licManager = new LicenseManager(tempDir);

        // Apply demo license so terminal is active
        licManager.GenerateAndApplyDemoLicense(30);

        // Seed test products strictly for unit testing
        prodRepo.CreateAsync(new Product { Sku = "SKU-MYK-001", Barcode = "8992753210014", Name = "Minyak Goreng Sania 2L", CategoryId = 1, UnitId = 1, BuyPrice = 31000, SellPrice = 36500, Stock = 48, MinStock = 10, ImagePath = "sania_2l.png", IsActive = true }).GetAwaiter().GetResult();
        prodRepo.CreateAsync(new Product { Sku = "SKU-MIE-001", Barcode = "089686010924", Name = "Indomie Goreng Spesial 85g", CategoryId = 1, UnitId = 1, BuyPrice = 2800, SellPrice = 3500, Stock = 120, MinStock = 24, ImagePath = "indomie_goreng.png", IsActive = true }).GetAwaiter().GetResult();

        var salesService = new SalesService(txRepo, prodRepo, storeRepo, licManager);
        var shiftService = new ShiftService(shiftRepo, txRepo);

        return (db, tempDir, salesService, shiftService, prodRepo, licManager);
    }

    [Fact]
    public async Task FullSaleFlow_DeductsStock_AndRecordsTransaction()
    {
        var (db, tempDir, sales, shiftService, prodRepo, _) = CreateTestEnvironment();

        try
        {
            // 1. Open Shift
            var shift = await shiftService.OpenShiftAsync(1, "Kasir 01", 100000);
            Assert.NotNull(shift);
            Assert.False(shift.IsClosed);

            // 2. Pick Product (Minyak Sania, stock was 48, price 36.500)
            var prod = await prodRepo.GetByBarcodeOrSkuAsync("8992753210014");
            Assert.NotNull(prod);
            decimal initialStock = prod.Stock;

            // 3. Add to Cart (2 bottles)
            sales.AddProduct(prod, 2);
            var summary = await sales.GetCurrentSummaryAsync();
            Assert.Equal(73000, summary.SubTotal); // 36500 * 2 = 73000

            // 4. Checkout with Cash 100.000
            var payments = new List<Payment>
            {
                new() { Method = PaymentMethod.Cash, Amount = 100000 }
            };

            var tx = await sales.CheckoutAsync(
                cashierId: 1,
                cashierName: "Kasir 01",
                shiftId: shift.Id,
                payments: payments,
                paidAmount: 100000);

            Assert.NotNull(tx);
            Assert.Equal(summary.GrandTotal, tx.GrandTotal);
            Assert.Equal(100000 - summary.GrandTotal, tx.ChangeAmount);
            Assert.Equal(TransactionStatus.Completed, tx.Status);

            // 5. Verify Stock Deducted
            var reloadedProd = await prodRepo.GetByIdAsync(prod.Id);
            Assert.NotNull(reloadedProd);
            Assert.Equal(initialStock - 2, reloadedProd.Stock);

            // 6. Verify Stock Movement Log
            var movements = (await prodRepo.GetStockMovementsAsync(prod.Id)).ToList();
            Assert.NotEmpty(movements);
            Assert.Equal(StockMovementType.Sale, movements[0].Type);
            Assert.Equal(-2, movements[0].Quantity);

            // 7. Verify Shift Cash Reconciliation
            var (expectedCash, cashSales, _, count) = await shiftService.CalculateShiftSummaryAsync(shift.Id);
            Assert.Equal(1, count);
            Assert.Equal(summary.GrandTotal, cashSales); // Net cash collected = GrandTotal
            Assert.Equal(100000 + summary.GrandTotal, expectedCash); // Opening (100k) + Sales

            // 8. Close Shift
            var closedShift = await shiftService.CloseShiftAsync(shift.Id, expectedCash, "Uang kasir pas");
            Assert.True(closedShift.IsClosed);
            Assert.Equal(0, closedShift.Discrepancy);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, true); } catch { }
            }
        }
    }

    [Fact]
    public async Task HoldAndRecallOrder_WorksCorrectly()
    {
        var (db, tempDir, sales, shiftService, prodRepo, _) = CreateTestEnvironment();

        try
        {
            var shift = await shiftService.OpenShiftAsync(1, "Kasir 01", 100000);

            var prod1 = await prodRepo.GetByBarcodeOrSkuAsync("8992753210014"); // Minyak
            var prod2 = await prodRepo.GetByBarcodeOrSkuAsync("089686010924");  // Indomie

            sales.AddProduct(prod1!, 1);
            sales.AddProduct(prod2!, 5);
            Assert.Equal(2, sales.ActiveCart.Count);

            // Hold Order
            int heldId = await sales.HoldOrderAsync(1, "Kasir 01", shift.Id, "Pelanggan ambil barang tambahan");
            Assert.Empty(sales.ActiveCart); // Cart is cleared

            var heldList = (await sales.GetHeldOrdersAsync()).ToList();
            Assert.Single(heldList);
            Assert.Equal(heldId, heldList[0].Id);

            // Recall Order
            await sales.RecallOrderAsync(heldId);
            Assert.Equal(2, sales.ActiveCart.Count);
            Assert.Equal(prod1!.Id, sales.ActiveCart[0].ProductId);
            Assert.Equal(prod2!.Id, sales.ActiveCart[1].ProductId);
            Assert.Equal(5, sales.ActiveCart[1].Quantity);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, true); } catch { }
            }
        }
    }

    [Fact]
    public async Task Checkout_WhenLicenseExpired_ThrowsInvalidOperationException()
    {
        var (db, tempDir, sales, shiftService, prodRepo, licManager) = CreateTestEnvironment();

        try
        {
            var shift = await shiftService.OpenShiftAsync(1, "Kasir 01", 100000);
            var prod = await prodRepo.GetByBarcodeOrSkuAsync("8992753210014");
            sales.AddProduct(prod!, 1);

            // Simulate expired license beyond grace period (e.g. -30 days)
            string expiredSerial = LicenseCrypto.GenerateSerialKey(DateTime.Now.AddDays(-30), licManager.CurrentHardwareFingerprint, graceDays: 14);
            licManager.ActivateWithSerialKey(expiredSerial);

            Assert.False(licManager.CanTransact);

            var payments = new List<Payment> { new() { Method = PaymentMethod.Cash, Amount = 50000 } };

            // Checkout should be blocked
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            {
                await sales.CheckoutAsync(1, "Kasir 01", shift.Id, payments, 50000);
            });

            Assert.Contains("Transaksi ditolak", ex.Message);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, true); } catch { }
            }
        }
    }

    [Fact]
    public async Task ProductStockAndPhoto_CanBeUpdatedAndAudited()
    {
        var (db, tempDir, sales, shiftService, prodRepo, _) = CreateTestEnvironment();

        try
        {
            var prods = (await prodRepo.GetAllAsync(activeOnly: true)).ToList();
            Assert.NotEmpty(prods);

            // Verify seeded products have image paths and stocks
            var prod = prods.First();
            Assert.False(string.IsNullOrWhiteSpace(prod.ImagePath));
            Assert.True(prod.Stock > 0);

            // Update photo
            string newPhoto = "custom_new_photo.png";
            prod.ImagePath = newPhoto;
            await prodRepo.UpdateAsync(prod);

            var reloaded = await prodRepo.GetByIdAsync(prod.Id);
            Assert.NotNull(reloaded);
            Assert.Equal(newPhoto, reloaded.ImagePath);

            // Mutate stock (+15)
            decimal oldStock = reloaded.Stock;
            var movement = new StockMovement
            {
                Type = StockMovementType.Adjustment,
                Quantity = 15,
                Note = "Penerimaan Barang Tambahan",
                ReferenceNo = "TEST-ADJ-001"
            };
            await prodRepo.UpdateStockAsync(prod.Id, 15, movement);

            var afterMutation = await prodRepo.GetByIdAsync(prod.Id);
            Assert.NotNull(afterMutation);
            Assert.Equal(oldStock + 15, afterMutation.Stock);

            // Audit trail has the movement
            var movements = (await prodRepo.GetStockMovementsAsync(prod.Id, 10)).ToList();
            Assert.Contains(movements, m => m.ReferenceNo == "TEST-ADJ-001" && m.Quantity == 15);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, true); } catch { }
            }
        }
    }
}
