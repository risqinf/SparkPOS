using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using POS.Domain;

namespace POS.Application;

public class DailySalesSummary
{
    public DateTime Date { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalSubtotal { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalTax { get; set; }
    public int TransactionCount { get; set; }
    public decimal AverageBasketSize { get; set; }
    public decimal TotalCash { get; set; }
    public decimal TotalQris { get; set; }
    public decimal TotalDebit { get; set; }
    public decimal TotalOther { get; set; }
}

public class ProductSaleRanking
{
    public int ProductId { get; set; }
    public string ProductSku { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public decimal TotalQuantitySold { get; set; }
    public decimal TotalRevenue { get; set; }
}

public class ReportService
{
    private readonly ITransactionRepository _txRepo;
    private readonly IProductRepository _productRepo;

    public ReportService(ITransactionRepository txRepo, IProductRepository productRepo)
    {
        _txRepo = txRepo;
        _productRepo = productRepo;
    }

    public async Task<DailySalesSummary> GetDailySummaryAsync(DateTime date)
    {
        var transactions = (await _txRepo.GetByDateRangeAsync(date, date))
            .Where(t => t.Status == TransactionStatus.Completed)
            .ToList();

        var summary = new DailySalesSummary
        {
            Date = date.Date,
            TransactionCount = transactions.Count,
            TotalRevenue = transactions.Sum(t => t.GrandTotal),
            TotalSubtotal = transactions.Sum(t => t.SubTotal),
            TotalDiscount = transactions.Sum(t => t.DiscountItemTotal + t.DiscountOrderAmount),
            TotalTax = transactions.Sum(t => t.TaxAmount)
        };

        if (summary.TransactionCount > 0)
        {
            summary.AverageBasketSize = Math.Round(summary.TotalRevenue / summary.TransactionCount, 0);
        }

        foreach (var tx in transactions)
        {
            foreach (var p in tx.Payments)
            {
                switch (p.Method)
                {
                    case PaymentMethod.Cash:
                        summary.TotalCash += (p.Amount - tx.ChangeAmount);
                        break;
                    case PaymentMethod.Qris:
                        summary.TotalQris += p.Amount;
                        break;
                    case PaymentMethod.Debit:
                    case PaymentMethod.Credit:
                        summary.TotalDebit += p.Amount;
                        break;
                    default:
                        summary.TotalOther += p.Amount;
                        break;
                }
            }
        }

        return summary;
    }

    public async Task<IEnumerable<ProductSaleRanking>> GetTopSellingProductsAsync(DateTime fromDate, DateTime toDate, int limit = 10)
    {
        var transactions = (await _txRepo.GetByDateRangeAsync(fromDate, toDate))
            .Where(t => t.Status == TransactionStatus.Completed);

        var rankings = new Dictionary<int, ProductSaleRanking>();

        foreach (var tx in transactions)
        {
            // Reload full tx with details if needed
            var fullTx = await _txRepo.GetByIdAsync(tx.Id);
            if (fullTx?.Details == null) continue;

            foreach (var d in fullTx.Details)
            {
                if (!rankings.TryGetValue(d.ProductId, out var r))
                {
                    r = new ProductSaleRanking
                    {
                        ProductId = d.ProductId,
                        ProductSku = d.ProductSku,
                        ProductName = d.ProductName
                    };
                    rankings[d.ProductId] = r;
                }

                r.TotalQuantitySold += d.Quantity;
                r.TotalRevenue += d.Subtotal;
            }
        }

        return rankings.Values
            .OrderByDescending(r => r.TotalQuantitySold)
            .Take(limit);
    }

    public async Task<IEnumerable<Product>> GetLowStockProductsAsync()
    {
        var all = await _productRepo.GetAllAsync(activeOnly: true);
        return all.Where(p => p.Stock <= p.MinStock).OrderBy(p => p.Stock);
    }
}
