using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using POS.Domain;
using POS.License;

namespace POS.Application;

public class SalesService
{
    private readonly ITransactionRepository _txRepo;
    private readonly IProductRepository _productRepo;
    private readonly IStoreProfileRepository _storeRepo;
    private readonly LicenseManager _licenseManager;

    private readonly List<TransactionDetail> _activeCart = new();
    public IReadOnlyList<TransactionDetail> ActiveCart => _activeCart.AsReadOnly();

    public LicenseManager LicenseManager => _licenseManager;
    public decimal OrderDiscountPercent { get; set; } = 0;
    public decimal OrderDiscountNominal { get; set; } = 0;
    public int? SelectedCustomerId { get; set; }
    public string? SelectedCustomerName { get; set; }

    public SalesService(
        ITransactionRepository txRepo,
        IProductRepository productRepo,
        IStoreProfileRepository storeRepo,
        LicenseManager licenseManager)
    {
        _txRepo = txRepo;
        _productRepo = productRepo;
        _storeRepo = storeRepo;
        _licenseManager = licenseManager;
    }

    public void AddProduct(Product product, decimal quantity = 1)
    {
        var existing = _activeCart.FirstOrDefault(x => x.ProductId == product.Id);
        if (existing != null)
        {
            existing.Quantity += quantity;
            existing.Subtotal = CartCalculator.CalculateLineSubtotal(existing.UnitPrice, existing.Quantity, existing.DiscountAmount);
        }
        else
        {
            var item = new TransactionDetail
            {
                ProductId = product.Id,
                ProductSku = product.Sku,
                ProductName = product.Name,
                UnitPrice = product.SellPrice,
                Quantity = quantity,
                DiscountAmount = 0,
                Subtotal = CartCalculator.CalculateLineSubtotal(product.SellPrice, quantity, 0)
            };
            _activeCart.Add(item);
        }
    }

    public void UpdateItemQuantity(int productId, decimal quantity)
    {
        var item = _activeCart.FirstOrDefault(x => x.ProductId == productId);
        if (item != null)
        {
            if (quantity <= 0)
            {
                _activeCart.Remove(item);
            }
            else
            {
                item.Quantity = quantity;
                item.Subtotal = CartCalculator.CalculateLineSubtotal(item.UnitPrice, item.Quantity, item.DiscountAmount);
            }
        }
    }

    public void SetItemDiscount(int productId, decimal discountAmount)
    {
        var item = _activeCart.FirstOrDefault(x => x.ProductId == productId);
        if (item != null)
        {
            item.DiscountAmount = Math.Max(0, discountAmount);
            item.Subtotal = CartCalculator.CalculateLineSubtotal(item.UnitPrice, item.Quantity, item.DiscountAmount);
        }
    }

    public void RemoveItem(int productId)
    {
        _activeCart.RemoveAll(x => x.ProductId == productId);
    }

    public void ClearCart()
    {
        _activeCart.Clear();
        OrderDiscountPercent = 0;
        OrderDiscountNominal = 0;
        SelectedCustomerId = null;
        SelectedCustomerName = null;
    }

    public async Task<CartSummary> GetCurrentSummaryAsync()
    {
        var profile = await _storeRepo.GetProfileAsync();
        return CartCalculator.Calculate(
            _activeCart,
            OrderDiscountPercent,
            OrderDiscountNominal,
            profile.TaxPercentage,
            profile.DefaultTaxInclusive);
    }

    public async Task<Transaction> CheckoutAsync(
        int cashierId,
        string cashierName,
        int shiftId,
        List<Payment> payments,
        decimal paidAmount,
        string notes = "")
    {
        // 1. License Check (PRD §8.9)
        var maxDbDate = await _txRepo.GetMaxTransactionDateAsync();
        var licResult = _licenseManager.EvaluateLicense(maxDbDate);
        if (!_licenseManager.CanTransact)
        {
            throw new InvalidOperationException($"Transaksi ditolak: {licResult.Message}");
        }

        if (_activeCart.Count == 0)
            throw new InvalidOperationException("Keranjang belanja masih kosong.");

        var profile = await _storeRepo.GetProfileAsync();
        var summary = CartCalculator.Calculate(
            _activeCart,
            OrderDiscountPercent,
            OrderDiscountNominal,
            profile.TaxPercentage,
            profile.DefaultTaxInclusive);

        if (paidAmount < summary.GrandTotal)
            throw new InvalidOperationException($"Uang pembayaran (Rp {paidAmount:N0}) kurang dari total tagihan (Rp {summary.GrandTotal:N0}).");

        decimal change = paidAmount - summary.GrandTotal;
        string invoiceNumber = GenerateInvoiceNumber();

        var tx = new Transaction
        {
            InvoiceNumber = invoiceNumber,
            CashierId = cashierId,
            CashierName = cashierName,
            ShiftId = shiftId,
            CustomerId = SelectedCustomerId,
            CustomerName = SelectedCustomerName,
            SubTotal = summary.SubTotal,
            DiscountItemTotal = summary.DiscountItemTotal,
            DiscountOrderPercent = OrderDiscountPercent,
            DiscountOrderAmount = summary.DiscountOrderAmount,
            TaxPercent = summary.TaxPercent,
            TaxAmount = summary.TaxAmount,
            IsTaxInclusive = summary.IsTaxInclusive,
            GrandTotal = summary.GrandTotal,
            PaidAmount = paidAmount,
            ChangeAmount = change,
            Status = TransactionStatus.Completed,
            Notes = notes,
            CreatedAt = DateTime.Now,
            Details = _activeCart.Select(d => new TransactionDetail
            {
                ProductId = d.ProductId,
                ProductSku = d.ProductSku,
                ProductName = d.ProductName,
                UnitPrice = d.UnitPrice,
                Quantity = d.Quantity,
                DiscountAmount = d.DiscountAmount,
                Subtotal = d.Subtotal
            }).ToList(),
            Payments = payments
        };

        int id = await _txRepo.CreateAsync(tx);
        tx.Id = id;

        // Clear active cart after successful save
        ClearCart();

        return tx;
    }

    public async Task<int> HoldOrderAsync(int cashierId, string cashierName, int shiftId, string note = "")
    {
        if (_activeCart.Count == 0)
            throw new InvalidOperationException("Keranjang kosong, tidak dapat menyimpan hold order.");

        var profile = await _storeRepo.GetProfileAsync();
        var summary = CartCalculator.Calculate(
            _activeCart,
            OrderDiscountPercent,
            OrderDiscountNominal,
            profile.TaxPercentage,
            profile.DefaultTaxInclusive);

        string invoiceNumber = "HOLD-" + DateTime.Now.ToString("HHmmssff");

        var tx = new Transaction
        {
            InvoiceNumber = invoiceNumber,
            CashierId = cashierId,
            CashierName = cashierName,
            ShiftId = shiftId,
            CustomerId = SelectedCustomerId,
            CustomerName = SelectedCustomerName,
            SubTotal = summary.SubTotal,
            DiscountItemTotal = summary.DiscountItemTotal,
            DiscountOrderPercent = OrderDiscountPercent,
            DiscountOrderAmount = summary.DiscountOrderAmount,
            TaxPercent = summary.TaxPercent,
            TaxAmount = summary.TaxAmount,
            IsTaxInclusive = summary.IsTaxInclusive,
            GrandTotal = summary.GrandTotal,
            PaidAmount = 0,
            ChangeAmount = 0,
            Status = TransactionStatus.Held,
            Notes = note,
            CreatedAt = DateTime.Now,
            Details = _activeCart.Select(d => new TransactionDetail
            {
                ProductId = d.ProductId,
                ProductSku = d.ProductSku,
                ProductName = d.ProductName,
                UnitPrice = d.UnitPrice,
                Quantity = d.Quantity,
                DiscountAmount = d.DiscountAmount,
                Subtotal = d.Subtotal
            }).ToList()
        };

        int id = await _txRepo.CreateAsync(tx);
        ClearCart();
        return id;
    }

    public async Task RecallOrderAsync(int transactionId)
    {
        var tx = await _txRepo.GetByIdAsync(transactionId);
        if (tx == null || tx.Status != TransactionStatus.Held)
            throw new InvalidOperationException("Order tertunda tidak ditemukan.");

        ClearCart();
        foreach (var d in tx.Details)
        {
            _activeCart.Add(new TransactionDetail
            {
                ProductId = d.ProductId,
                ProductSku = d.ProductSku,
                ProductName = d.ProductName,
                UnitPrice = d.UnitPrice,
                Quantity = d.Quantity,
                DiscountAmount = d.DiscountAmount,
                Subtotal = d.Subtotal
            });
        }

        OrderDiscountPercent = tx.DiscountOrderPercent;
        OrderDiscountNominal = tx.DiscountOrderAmount;
        SelectedCustomerId = tx.CustomerId;
        SelectedCustomerName = tx.CustomerName;

        // Mark previous held record as voided/recalled
        await _txRepo.UpdateStatusAsync(transactionId, TransactionStatus.Voided);
    }

    public async Task<IEnumerable<Transaction>> GetHeldOrdersAsync()
    {
        var recent = await _txRepo.GetRecentAsync(50);
        return recent.Where(t => t.Status == TransactionStatus.Held);
    }

    private static string GenerateInvoiceNumber()
    {
        return $"INV-{DateTime.Now:yyyyMMdd}-{DateTime.Now:HHmmss}-{Random.Shared.Next(100, 999)}";
    }
}
