using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace POS.Domain;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(int id);
    Task<Product?> GetByBarcodeOrSkuAsync(string code);
    Task<IEnumerable<Product>> GetAllAsync(bool activeOnly = true);
    Task<IEnumerable<Product>> SearchAsync(string query);
    Task<IEnumerable<Product>> GetByCategoryAsync(int categoryId);
    Task<int> CreateAsync(Product product);
    Task<bool> UpdateAsync(Product product);
    Task<bool> DeleteAsync(int id);
    Task<bool> UpdateStockAsync(int productId, decimal deltaQty, StockMovement movement);
    Task<IEnumerable<StockMovement>> GetStockMovementsAsync(int productId, int limit = 50);
}

public interface ICategoryRepository
{
    Task<IEnumerable<Category>> GetAllAsync();
    Task<Category?> GetByIdAsync(int id);
    Task<int> CreateAsync(Category category);
}

public interface ITransactionRepository
{
    Task<Transaction?> GetByIdAsync(int id);
    Task<Transaction?> GetByInvoiceNumberAsync(string invoiceNumber);
    Task<IEnumerable<Transaction>> GetRecentAsync(int limit = 50);
    Task<IEnumerable<Transaction>> GetByShiftAsync(int shiftId);
    Task<IEnumerable<Transaction>> GetByDateRangeAsync(DateTime fromDate, DateTime toDate);
    Task<int> CreateAsync(Transaction transaction);
    Task<bool> UpdateStatusAsync(int id, TransactionStatus status);
    Task<DateTime?> GetMaxTransactionDateAsync();
}

public interface IShiftRepository
{
    Task<Shift?> GetActiveShiftAsync(int employeeId);
    Task<Shift?> GetByIdAsync(int id);
    Task<IEnumerable<Shift>> GetRecentShiftsAsync(int limit = 30);
    Task<int> OpenShiftAsync(Shift shift);
    Task<bool> CloseShiftAsync(Shift shift);
    Task<int> AddCashDrawerLogAsync(CashDrawerLog log);
    Task<IEnumerable<CashDrawerLog>> GetCashDrawerLogsAsync(int shiftId);
    Task<DateTime?> GetMaxShiftDateAsync();
}

public interface IEmployeeRepository
{
    Task<Employee?> GetByIdAsync(int id);
    Task<Employee?> GetByUsernameAsync(string username);
    Task<Employee?> AuthenticateAsync(string username, string pin);
    Task<Employee?> AuthenticatePinOnlyAsync(string pin);
    Task<IEnumerable<Employee>> GetAllAsync();
    Task<int> CreateAsync(Employee employee);
    Task<bool> UpdateAsync(Employee employee);
}

public interface IStoreProfileRepository
{
    Task<StoreProfile> GetProfileAsync();
    Task<bool> UpdateProfileAsync(StoreProfile profile);
}

public interface ILicenseRepository
{
    Task<LicenseInfo?> GetCurrentLicenseAsync();
    Task<bool> SaveLicenseAsync(LicenseInfo license);
}
