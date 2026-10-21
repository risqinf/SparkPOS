using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using POS.Domain;

namespace POS.Infrastructure.Repositories;

public class TransactionRepository : ITransactionRepository
{
    private readonly DatabaseContext _context;

    public TransactionRepository(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<Transaction?> GetByIdAsync(int id)
    {
        using var conn = _context.CreateConnection();
        var tx = await conn.QueryFirstOrDefaultAsync<Transaction>(
            "SELECT * FROM Transactions WHERE Id = @Id", new { Id = id });

        if (tx == null) return null;

        var details = await conn.QueryAsync<TransactionDetail>(
            "SELECT * FROM TransactionDetails WHERE TransactionId = @Id", new { Id = id });
        tx.Details = details.ToList();

        var payments = await conn.QueryAsync<Payment>(
            "SELECT * FROM Payments WHERE TransactionId = @Id", new { Id = id });
        tx.Payments = payments.ToList();

        return tx;
    }

    public async Task<Transaction?> GetByInvoiceNumberAsync(string invoiceNumber)
    {
        using var conn = _context.CreateConnection();
        var tx = await conn.QueryFirstOrDefaultAsync<Transaction>(
            "SELECT * FROM Transactions WHERE InvoiceNumber = @Inv", new { Inv = invoiceNumber.Trim() });

        if (tx == null) return null;

        var details = await conn.QueryAsync<TransactionDetail>(
            "SELECT * FROM TransactionDetails WHERE TransactionId = @Id", new { Id = tx.Id });
        tx.Details = details.ToList();

        var payments = await conn.QueryAsync<Payment>(
            "SELECT * FROM Payments WHERE TransactionId = @Id", new { Id = tx.Id });
        tx.Payments = payments.ToList();

        return tx;
    }

    public async Task<IEnumerable<Transaction>> GetRecentAsync(int limit = 50)
    {
        using var conn = _context.CreateConnection();
        var list = (await conn.QueryAsync<Transaction>(
            "SELECT * FROM Transactions ORDER BY CreatedAt DESC LIMIT @Limit", new { Limit = limit })).ToList();
        await PopulateRelationsAsync(conn, list);
        return list;
    }

    public async Task<IEnumerable<Transaction>> GetByShiftAsync(int shiftId)
    {
        using var conn = _context.CreateConnection();
        var list = (await conn.QueryAsync<Transaction>(
            "SELECT * FROM Transactions WHERE ShiftId = @ShiftId ORDER BY CreatedAt DESC", new { ShiftId = shiftId })).ToList();
        await PopulateRelationsAsync(conn, list);
        return list;
    }

    public async Task<IEnumerable<Transaction>> GetByDateRangeAsync(DateTime fromDate, DateTime toDate)
    {
        using var conn = _context.CreateConnection();
        string from = fromDate.Date.ToString("O");
        string to = toDate.Date.AddDays(1).AddTicks(-1).ToString("O");

        var list = (await conn.QueryAsync<Transaction>(
            "SELECT * FROM Transactions WHERE CreatedAt >= @From AND CreatedAt <= @To ORDER BY CreatedAt DESC", 
            new { From = from, To = to })).ToList();
        await PopulateRelationsAsync(conn, list);
        return list;
    }

    private static async Task PopulateRelationsAsync(Microsoft.Data.Sqlite.SqliteConnection conn, List<Transaction> list)
    {
        if (list.Count == 0) return;

        var ids = list.Select(t => t.Id).ToList();
        string inClause = string.Join(",", ids);

        var details = (await conn.QueryAsync<TransactionDetail>(
            $"SELECT * FROM TransactionDetails WHERE TransactionId IN ({inClause})")).ToList();
        var payments = (await conn.QueryAsync<Payment>(
            $"SELECT * FROM Payments WHERE TransactionId IN ({inClause})")).ToList();

        var detailsByTx = details.ToLookup(d => d.TransactionId);
        var paymentsByTx = payments.ToLookup(p => p.TransactionId);

        foreach (var t in list)
        {
            t.Details = detailsByTx[t.Id].ToList();
            t.Payments = paymentsByTx[t.Id].ToList();
        }
    }

    public async Task<int> CreateAsync(Transaction transaction)
    {
        using var conn = _context.CreateConnection();
        using var tran = conn.BeginTransaction();

        try
        {
            string txSql = @"
                INSERT INTO Transactions (
                    InvoiceNumber, CashierId, CashierName, ShiftId, CustomerId, CustomerName,
                    SubTotal, DiscountItemTotal, DiscountOrderPercent, DiscountOrderAmount,
                    TaxPercent, TaxAmount, IsTaxInclusive, GrandTotal, PaidAmount, ChangeAmount,
                    Status, Notes, CreatedAt
                ) VALUES (
                    @InvoiceNumber, @CashierId, @CashierName, @ShiftId, @CustomerId, @CustomerName,
                    @SubTotal, @DiscountItemTotal, @DiscountOrderPercent, @DiscountOrderAmount,
                    @TaxPercent, @TaxAmount, @IsTaxInclusive, @GrandTotal, @PaidAmount, @ChangeAmount,
                    @Status, @Notes, @CreatedAt
                );
                SELECT last_insert_rowid();";

            int txId = await conn.ExecuteScalarAsync<int>(txSql, new {
                transaction.InvoiceNumber,
                transaction.CashierId,
                transaction.CashierName,
                transaction.ShiftId,
                transaction.CustomerId,
                transaction.CustomerName,
                transaction.SubTotal,
                transaction.DiscountItemTotal,
                transaction.DiscountOrderPercent,
                transaction.DiscountOrderAmount,
                transaction.TaxPercent,
                transaction.TaxAmount,
                IsTaxInclusive = transaction.IsTaxInclusive ? 1 : 0,
                transaction.GrandTotal,
                transaction.PaidAmount,
                transaction.ChangeAmount,
                Status = (int)transaction.Status,
                transaction.Notes,
                CreatedAt = transaction.CreatedAt.ToString("O")
            }, tran);

            transaction.Id = txId;

            // Details and stock reduction
            foreach (var detail in transaction.Details)
            {
                detail.TransactionId = txId;
                await conn.ExecuteAsync(@"
                    INSERT INTO TransactionDetails (TransactionId, ProductId, ProductSku, ProductName, UnitPrice, Quantity, DiscountAmount, Subtotal)
                    VALUES (@TransactionId, @ProductId, @ProductSku, @ProductName, @UnitPrice, @Quantity, @DiscountAmount, @Subtotal)",
                    detail, tran);

                if (transaction.Status == TransactionStatus.Completed)
                {
                    // Deduct stock
                    await conn.ExecuteAsync(@"
                        UPDATE Products SET Stock = Stock - @Qty WHERE Id = @ProdId",
                        new { Qty = detail.Quantity, ProdId = detail.ProductId }, tran);

                    decimal currentStock = await conn.ExecuteScalarAsync<decimal>(@"
                        SELECT Stock FROM Products WHERE Id = @ProdId",
                        new { ProdId = detail.ProductId }, tran);

                    // Stock movement record
                    await conn.ExecuteAsync(@"
                        INSERT INTO StockMovements (ProductId, Type, Quantity, BalanceAfter, ReferenceNo, Note, Timestamp)
                        VALUES (@ProductId, @Type, @Quantity, @BalanceAfter, @ReferenceNo, @Note, @Timestamp)",
                        new {
                            ProductId = detail.ProductId,
                            Type = (int)StockMovementType.Sale,
                            Quantity = -detail.Quantity,
                            BalanceAfter = currentStock,
                            ReferenceNo = transaction.InvoiceNumber,
                            Note = $"Penjualan Nota #{transaction.InvoiceNumber}",
                            Timestamp = transaction.CreatedAt.ToString("O")
                        }, tran);
                }
            }

            // Payments
            foreach (var payment in transaction.Payments)
            {
                payment.TransactionId = txId;
                await conn.ExecuteAsync(@"
                    INSERT INTO Payments (TransactionId, Method, Amount, ReferenceNumber, CreatedAt)
                    VALUES (@TransactionId, @Method, @Amount, @ReferenceNumber, @CreatedAt)",
                    new {
                        payment.TransactionId,
                        Method = (int)payment.Method,
                        payment.Amount,
                        payment.ReferenceNumber,
                        CreatedAt = payment.CreatedAt.ToString("O")
                    }, tran);
            }

            tran.Commit();
            return txId;
        }
        catch
        {
            tran.Rollback();
            throw;
        }
    }

    public async Task<bool> UpdateStatusAsync(int id, TransactionStatus status)
    {
        using var conn = _context.CreateConnection();
        int rows = await conn.ExecuteAsync(
            "UPDATE Transactions SET Status = @Status WHERE Id = @Id", 
            new { Status = (int)status, Id = id });
        return rows > 0;
    }

    public async Task<DateTime?> GetMaxTransactionDateAsync()
    {
        using var conn = _context.CreateConnection();
        string? maxStr = await conn.ExecuteScalarAsync<string>(
            "SELECT MAX(CreatedAt) FROM Transactions");

        if (string.IsNullOrEmpty(maxStr))
            return null;

        if (DateTime.TryParse(maxStr, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
            return dt;

        return null;
    }
}
