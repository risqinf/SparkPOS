namespace POS.Domain;

public enum RoleType
{
    Cashier = 1,
    Supervisor = 2,
    Admin = 3
}

public enum TransactionStatus
{
    Completed = 1,
    Held = 2,
    Voided = 3,
    Returned = 4
}

public enum PaymentMethod
{
    Cash = 1,
    Qris = 2,
    Debit = 3,
    Credit = 4,
    Split = 5
}

public enum StockMovementType
{
    Sale = 1,
    Purchase = 2,
    Return = 3,
    Adjustment = 4,
    Opname = 5
}

public enum LicenseStatus
{
    Active = 1,
    GracePeriod = 2,
    Expired = 3,
    Tampered = 4,
    InvalidHardware = 5,
    Unregistered = 6
}
