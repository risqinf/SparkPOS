using System;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.Sqlite;

namespace POS.Infrastructure;

public static class DatabaseMigrator
{
    public static async Task MigrateAsync(DatabaseContext context)
    {
        using var connection = context.CreateConnection();

        string ddl = @"
            -- Employees
            CREATE TABLE IF NOT EXISTS Employees (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Username TEXT NOT NULL UNIQUE,
                FullName TEXT NOT NULL,
                Pin TEXT NOT NULL,
                Role INTEGER NOT NULL DEFAULT 1,
                IsActive INTEGER NOT NULL DEFAULT 1,
                CreatedAt TEXT NOT NULL
            );

            -- Shifts
            CREATE TABLE IF NOT EXISTS Shifts (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                EmployeeId INTEGER NOT NULL,
                EmployeeName TEXT NOT NULL,
                StartTime TEXT NOT NULL,
                EndTime TEXT,
                OpeningCash NUMERIC NOT NULL,
                ClosingCash NUMERIC,
                ExpectedCash NUMERIC NOT NULL DEFAULT 0,
                Discrepancy NUMERIC NOT NULL DEFAULT 0,
                Note TEXT,
                IsClosed INTEGER NOT NULL DEFAULT 0
            );

            -- Cash Drawer Logs
            CREATE TABLE IF NOT EXISTS CashDrawerLogs (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ShiftId INTEGER NOT NULL,
                Timestamp TEXT NOT NULL,
                Type TEXT NOT NULL,
                Amount NUMERIC NOT NULL,
                Reason TEXT
            );

            -- Categories
            CREATE TABLE IF NOT EXISTS Categories (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL UNIQUE,
                Description TEXT
            );

            -- Units
            CREATE TABLE IF NOT EXISTS Units (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL UNIQUE,
                Symbol TEXT NOT NULL
            );

            -- Products
            CREATE TABLE IF NOT EXISTS Products (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Sku TEXT NOT NULL UNIQUE,
                Barcode TEXT NOT NULL,
                Name TEXT NOT NULL,
                CategoryId INTEGER NOT NULL,
                UnitId INTEGER NOT NULL,
                BuyPrice NUMERIC NOT NULL DEFAULT 0,
                SellPrice NUMERIC NOT NULL DEFAULT 0,
                Stock NUMERIC NOT NULL DEFAULT 0,
                MinStock NUMERIC NOT NULL DEFAULT 5,
                ImagePath TEXT DEFAULT '',
                IsActive INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_products_barcode ON Products(Barcode);
            CREATE INDEX IF NOT EXISTS idx_products_sku ON Products(Sku);

            -- Stock Movements
            CREATE TABLE IF NOT EXISTS StockMovements (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ProductId INTEGER NOT NULL,
                Type INTEGER NOT NULL,
                Quantity NUMERIC NOT NULL,
                BalanceAfter NUMERIC NOT NULL,
                ReferenceNo TEXT,
                Note TEXT,
                Timestamp TEXT NOT NULL
            );

            -- Transactions
            CREATE TABLE IF NOT EXISTS Transactions (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                InvoiceNumber TEXT NOT NULL UNIQUE,
                CashierId INTEGER NOT NULL,
                CashierName TEXT NOT NULL,
                ShiftId INTEGER NOT NULL,
                CustomerId INTEGER,
                CustomerName TEXT,
                SubTotal NUMERIC NOT NULL,
                DiscountItemTotal NUMERIC NOT NULL DEFAULT 0,
                DiscountOrderPercent NUMERIC NOT NULL DEFAULT 0,
                DiscountOrderAmount NUMERIC NOT NULL DEFAULT 0,
                TaxPercent NUMERIC NOT NULL DEFAULT 11,
                TaxAmount NUMERIC NOT NULL DEFAULT 0,
                IsTaxInclusive INTEGER NOT NULL DEFAULT 0,
                GrandTotal NUMERIC NOT NULL,
                PaidAmount NUMERIC NOT NULL,
                ChangeAmount NUMERIC NOT NULL,
                Status INTEGER NOT NULL DEFAULT 1,
                Notes TEXT,
                CreatedAt TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tx_created ON Transactions(CreatedAt);
            CREATE INDEX IF NOT EXISTS idx_tx_shift ON Transactions(ShiftId);

            -- Transaction Details
            CREATE TABLE IF NOT EXISTS TransactionDetails (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                TransactionId INTEGER NOT NULL,
                ProductId INTEGER NOT NULL,
                ProductSku TEXT NOT NULL,
                ProductName TEXT NOT NULL,
                UnitPrice NUMERIC NOT NULL,
                Quantity NUMERIC NOT NULL,
                DiscountAmount NUMERIC NOT NULL DEFAULT 0,
                Subtotal NUMERIC NOT NULL,
                FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
            );

            -- Payments
            CREATE TABLE IF NOT EXISTS Payments (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                TransactionId INTEGER NOT NULL,
                Method INTEGER NOT NULL,
                Amount NUMERIC NOT NULL,
                ReferenceNumber TEXT,
                CreatedAt TEXT NOT NULL,
                FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
            );

            -- Customers
            CREATE TABLE IF NOT EXISTS Customers (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                Phone TEXT NOT NULL UNIQUE,
                Points INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL
            );

            -- Store Profile
            CREATE TABLE IF NOT EXISTS StoreProfile (
                Id INTEGER PRIMARY KEY,
                StoreName TEXT NOT NULL,
                BranchName TEXT NOT NULL,
                Address TEXT NOT NULL,
                Phone TEXT NOT NULL,
                ReceiptHeader TEXT NOT NULL,
                ReceiptFooter TEXT NOT NULL,
                TaxPercentage NUMERIC NOT NULL DEFAULT 11,
                DefaultTaxInclusive INTEGER NOT NULL DEFAULT 0
            );

            -- License Info
            CREATE TABLE IF NOT EXISTS LicenseInfo (
                Id INTEGER PRIMARY KEY,
                LicenseKey TEXT NOT NULL,
                ContractId TEXT NOT NULL,
                HardwareFingerprint TEXT NOT NULL,
                ClientName TEXT NOT NULL,
                OutletName TEXT NOT NULL,
                IssueDate TEXT NOT NULL,
                ExpiryDate TEXT NOT NULL,
                GracePeriodDays INTEGER NOT NULL DEFAULT 14,
                Status INTEGER NOT NULL,
                LastSyncDate TEXT,
                Signature TEXT,
                Features TEXT
            );
        ";

        await connection.ExecuteAsync(ddl);

        // Ensure ImagePath column exists if DB was created before
        try
        {
            await connection.ExecuteAsync("ALTER TABLE Products ADD COLUMN ImagePath TEXT DEFAULT '';");
        }
        catch
        {
            // Column already exists
        }

        // Seed initial data if tables are empty
        await SeedDataAsync(connection);
    }

    private static async Task SeedDataAsync(SqliteConnection connection)
    {
        // 1. Employees (Default credential: Login: Administrator, Password: 123456)
        int adminExists = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM Employees WHERE LOWER(Username) = 'administrator'");
        if (adminExists == 0)
        {
            await connection.ExecuteAsync(@"
                INSERT INTO Employees (Username, FullName, Pin, Role, IsActive, CreatedAt)
                VALUES ('Administrator', 'Administrator Utama', '123456', 3, 1, @Now)
            ", new { Now = DateTime.Now.ToString("O") });
        }

        // Clean up legacy dummy employees (kasir1, spv) if they have no shifts or transactions
        await connection.ExecuteAsync(@"
            DELETE FROM Employees 
            WHERE Username IN ('kasir1', 'spv') 
              AND Id NOT IN (SELECT DISTINCT CashierId FROM Transactions)
              AND Id NOT IN (SELECT DISTINCT EmployeeId FROM Shifts);
        ");

        // 2. Categories
        int catCount = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Categories");
        if (catCount == 0)
        {
            await connection.ExecuteAsync(@"
                INSERT INTO Categories (Name, Description) VALUES
                ('Sembako & Minyak', 'Beras, minyak goreng, gula, tepung'),
                ('Minuman Dingin', 'Air mineral, teh kemasan, kopi, jus'),
                ('Makanan Ringan', 'Keripik, biskuit, snack coklat'),
                ('Mie Instan & Bumbu', 'Mie instan berbagai rasa, bumbu masak'),
                ('Perawatan Diri', 'Sabun, sampo, pasta gigi')
            ");
        }

        // 3. Units
        int unitCount = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Units");
        if (unitCount == 0)
        {
            await connection.ExecuteAsync(@"
                INSERT INTO Units (Name, Symbol) VALUES
                ('Pieces', 'PCS'),
                ('Kardus / Dus', 'DUS'),
                ('Pack / Bungkus', 'PACK'),
                ('Botol', 'BTL'),
                ('Kilogram', 'KG')
            ");
        }

        // 4. Products: ZERO PRODUCTS BY DEFAULT (Full clean for production/fresh start)
        // Clean up sample demo products if they have never been transacted
        await connection.ExecuteAsync(@"
            DELETE FROM StockMovements WHERE ProductId IN (
                SELECT p.Id FROM Products p
                LEFT JOIN TransactionDetails td ON td.ProductId = p.Id
                WHERE td.Id IS NULL AND (p.Sku LIKE 'SKU-%' OR p.Barcode IN ('8992753210014','089686010924','089686010931','8999999014383','8999999510106'))
            );
            DELETE FROM Products WHERE Id NOT IN (
                SELECT DISTINCT ProductId FROM TransactionDetails
            ) AND (Sku LIKE 'SKU-%' OR Barcode IN ('8992753210014','089686010924','089686010931','8999999014383','8999999510106'));
        ");

        // 5. Customers / Members: ZERO CUSTOMERS BY DEFAULT
        await connection.ExecuteAsync(@"
            DELETE FROM Customers 
            WHERE Name IN ('Bpk. Bambang Sutrisno', 'Ibu Ratna Dewi', 'Ibu Siti Aminah')
              AND Id NOT IN (SELECT DISTINCT CustomerId FROM Transactions WHERE CustomerId IS NOT NULL);
        ");

        // 6. Store Profile
        int profCount = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM StoreProfile");
        if (profCount == 0)
        {
            await connection.ExecuteAsync(@"
                INSERT INTO StoreProfile (Id, StoreName, BranchName, Address, Phone, ReceiptHeader, ReceiptFooter, TaxPercentage, DefaultTaxInclusive)
                VALUES (1, 'Toko Ritel Saya', 'Cabang Utama', '', '',
                        'Selamat Datang di Toko Kami',
                        'Terima Kasih Atas Kunjungan Anda!', 0, 0)
            ");
        }
        else
        {
            // Fix any literal \n characters in existing database
            await connection.ExecuteAsync(@"
                UPDATE StoreProfile 
                SET ReceiptFooter = REPLACE(REPLACE(ReceiptFooter, '\r\n', CHAR(10)), '\n', CHAR(10)),
                    ReceiptHeader = REPLACE(REPLACE(ReceiptHeader, '\r\n', CHAR(10)), '\n', CHAR(10))
                WHERE ReceiptFooter LIKE '%\n%' OR ReceiptHeader LIKE '%\n%';
            ");
        }
    }
}
