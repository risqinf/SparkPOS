using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using POS.Domain;

namespace POS.Infrastructure.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly DatabaseContext _context;

    public ProductRepository(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<Product?> GetByIdAsync(int id)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Product>(@"
            SELECT p.*, c.Name as CategoryName, u.Symbol as UnitName 
            FROM Products p
            LEFT JOIN Categories c ON p.CategoryId = c.Id
            LEFT JOIN Units u ON p.UnitId = u.Id
            WHERE p.Id = @Id", new { Id = id });
    }

    public async Task<Product?> GetByBarcodeOrSkuAsync(string code)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Product>(@"
            SELECT p.*, c.Name as CategoryName, u.Symbol as UnitName 
            FROM Products p
            LEFT JOIN Categories c ON p.CategoryId = c.Id
            LEFT JOIN Units u ON p.UnitId = u.Id
            WHERE (p.Barcode = @Code OR p.Sku = @Code) AND p.IsActive = 1", new { Code = code.Trim() });
    }

    public async Task<IEnumerable<Product>> GetAllAsync(bool activeOnly = true)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            SELECT p.*, c.Name as CategoryName, u.Symbol as UnitName 
            FROM Products p
            LEFT JOIN Categories c ON p.CategoryId = c.Id
            LEFT JOIN Units u ON p.UnitId = u.Id";

        if (activeOnly)
            sql += " WHERE p.IsActive = 1";

        sql += " ORDER BY p.Name ASC";

        return await conn.QueryAsync<Product>(sql);
    }

    public async Task<IEnumerable<Product>> SearchAsync(string query)
    {
        using var conn = _context.CreateConnection();
        string q = $"%{query.Trim()}%";
        return await conn.QueryAsync<Product>(@"
            SELECT p.*, c.Name as CategoryName, u.Symbol as UnitName 
            FROM Products p
            LEFT JOIN Categories c ON p.CategoryId = c.Id
            LEFT JOIN Units u ON p.UnitId = u.Id
            WHERE p.IsActive = 1 AND (p.Name LIKE @Q OR p.Barcode LIKE @Q OR p.Sku LIKE @Q)
            ORDER BY p.Name ASC
            LIMIT 50", new { Q = q });
    }

    public async Task<IEnumerable<Product>> GetByCategoryAsync(int categoryId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Product>(@"
            SELECT p.*, c.Name as CategoryName, u.Symbol as UnitName 
            FROM Products p
            LEFT JOIN Categories c ON p.CategoryId = c.Id
            LEFT JOIN Units u ON p.UnitId = u.Id
            WHERE p.IsActive = 1 AND p.CategoryId = @CatId
            ORDER BY p.Name ASC", new { CatId = categoryId });
    }

    public async Task<int> CreateAsync(Product product)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            INSERT INTO Products (Sku, Barcode, Name, CategoryId, UnitId, BuyPrice, SellPrice, Stock, MinStock, ImagePath, IsActive)
            VALUES (@Sku, @Barcode, @Name, @CategoryId, @UnitId, @BuyPrice, @SellPrice, @Stock, @MinStock, @ImagePath, @IsActive);
            SELECT last_insert_rowid();";

        int id = await conn.ExecuteScalarAsync<int>(sql, product);
        product.Id = id;
        return id;
    }

    public async Task<bool> UpdateAsync(Product product)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            UPDATE Products SET
                Sku = @Sku,
                Barcode = @Barcode,
                Name = @Name,
                CategoryId = @CategoryId,
                UnitId = @UnitId,
                BuyPrice = @BuyPrice,
                SellPrice = @SellPrice,
                Stock = @Stock,
                MinStock = @MinStock,
                ImagePath = @ImagePath,
                IsActive = @IsActive
            WHERE Id = @Id";

        int rows = await conn.ExecuteAsync(sql, product);
        return rows > 0;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var conn = _context.CreateConnection();
        int txCount = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM TransactionDetails WHERE ProductId = @Id", new { Id = id });

        int rows;
        if (txCount == 0)
        {
            await conn.ExecuteAsync("DELETE FROM StockMovements WHERE ProductId = @Id", new { Id = id });
            rows = await conn.ExecuteAsync("DELETE FROM Products WHERE Id = @Id", new { Id = id });
        }
        else
        {
            rows = await conn.ExecuteAsync("UPDATE Products SET IsActive = 0 WHERE Id = @Id", new { Id = id });
        }
        return rows > 0;
    }

    public async Task<bool> UpdateStockAsync(int productId, decimal deltaQty, StockMovement movement)
    {
        using var conn = _context.CreateConnection();
        using var tran = conn.BeginTransaction();

        try
        {
            await conn.ExecuteAsync(@"
                UPDATE Products SET Stock = Stock + @Delta 
                WHERE Id = @ProductId", new { Delta = deltaQty, ProductId = productId }, tran);

            decimal newBalance = await conn.ExecuteScalarAsync<decimal>(@"
                SELECT Stock FROM Products WHERE Id = @ProductId", new { ProductId = productId }, tran);

            movement.ProductId = productId;
            movement.BalanceAfter = newBalance;
            movement.Timestamp = DateTime.Now;

            await conn.ExecuteAsync(@"
                INSERT INTO StockMovements (ProductId, Type, Quantity, BalanceAfter, ReferenceNo, Note, Timestamp)
                VALUES (@ProductId, @Type, @Quantity, @BalanceAfter, @ReferenceNo, @Note, @Timestamp)", 
                new {
                    movement.ProductId,
                    Type = (int)movement.Type,
                    movement.Quantity,
                    movement.BalanceAfter,
                    movement.ReferenceNo,
                    movement.Note,
                    Timestamp = movement.Timestamp.ToString("O")
                }, tran);

            tran.Commit();
            return true;
        }
        catch
        {
            tran.Rollback();
            throw;
        }
    }

    public async Task<IEnumerable<StockMovement>> GetStockMovementsAsync(int productId, int limit = 50)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<StockMovement>(@"
            SELECT * FROM StockMovements 
            WHERE ProductId = @ProductId 
            ORDER BY Timestamp DESC 
            LIMIT @Limit", new { ProductId = productId, Limit = limit });
    }
}
