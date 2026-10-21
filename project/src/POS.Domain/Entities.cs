using System;
using System.Collections.Generic;

namespace POS.Domain;

public class Employee
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Pin { get; set; } = string.Empty;
    public RoleType Role { get; set; } = RoleType.Cashier;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public class Shift
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; } = DateTime.Now;
    public DateTime? EndTime { get; set; }
    public decimal OpeningCash { get; set; }
    public decimal? ClosingCash { get; set; }
    public decimal ExpectedCash { get; set; }
    public decimal Discrepancy { get; set; }
    public string Note { get; set; } = string.Empty;
    public bool IsClosed { get; set; } = false;
}

public class CashDrawerLog
{
    public int Id { get; set; }
    public int ShiftId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.Now;
    public string Type { get; set; } = "CASH_IN"; // CASH_IN, CASH_OUT
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class Unit
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Symbol { get; set; } = string.Empty;
}

public class Product
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitName { get; set; } = "PCS";
    public decimal BuyPrice { get; set; }
    public decimal SellPrice { get; set; }
    public decimal Stock { get; set; }
    public decimal MinStock { get; set; } = 5;
    public string ImagePath { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public StockMovementType Type { get; set; }
    public decimal Quantity { get; set; }
    public decimal BalanceAfter { get; set; }
    public string ReferenceNo { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.Now;
}

public class Transaction
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public int CashierId { get; set; }
    public string CashierName { get; set; } = string.Empty;
    public int ShiftId { get; set; }
    public int? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public decimal SubTotal { get; set; }
    public decimal DiscountItemTotal { get; set; }
    public decimal DiscountOrderPercent { get; set; }
    public decimal DiscountOrderAmount { get; set; }
    public decimal TaxPercent { get; set; } = 11;
    public decimal TaxAmount { get; set; }
    public bool IsTaxInclusive { get; set; } = false;
    public decimal GrandTotal { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal ChangeAmount { get; set; }
    public TransactionStatus Status { get; set; } = TransactionStatus.Completed;
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public List<TransactionDetail> Details { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
}

public class TransactionDetail
{
    public int Id { get; set; }
    public int TransactionId { get; set; }
    public int ProductId { get; set; }
    public string ProductSku { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal Subtotal { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public int TransactionId { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal Amount { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public int Points { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public class StoreProfile
{
    public int Id { get; set; } = 1;
    public string StoreName { get; set; } = "Toko Berkah Jaya";
    public string BranchName { get; set; } = "Cabang Utama";
    public string Address { get; set; } = "Jl. Sudirman No. 45, Jakarta";
    public string Phone { get; set; } = "021-5551234";
    public string ReceiptHeader { get; set; } = "Selamat Datang di Toko Berkah Jaya\nBelanja Hemat Setiap Hari";
    public string ReceiptFooter { get; set; } = "Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.";
    public decimal TaxPercentage { get; set; } = 11;
    public bool DefaultTaxInclusive { get; set; } = false;
}

public class LicenseInfo
{
    public string LicenseKey { get; set; } = string.Empty;
    public string ContractId { get; set; } = string.Empty;
    public string HardwareFingerprint { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string OutletName { get; set; } = string.Empty;
    public DateTime IssueDate { get; set; }
    public DateTime ExpiryDate { get; set; }
    public int GracePeriodDays { get; set; } = 14;
    public LicenseStatus Status { get; set; } = LicenseStatus.Unregistered;
    public DateTime? LastSyncDate { get; set; }
    public string Signature { get; set; } = string.Empty;
    public string Features { get; set; } = "STANDARD,OFFLINE_POS";
}
