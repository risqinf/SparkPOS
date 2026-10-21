using System;
using POS.Domain;

namespace POS.License;

public class LicensePayload
{
    public string ContractId { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string OutletName { get; set; } = string.Empty;
    public string HardwareFingerprint { get; set; } = string.Empty;
    public DateTime IssueDate { get; set; }
    public DateTime ExpiryDate { get; set; }
    public int GracePeriodDays { get; set; } = 14;
    public string Features { get; set; } = "STANDARD,OFFLINE_POS";
    public string FormatType { get; set; } = "FILE"; // "FILE" or "SERIAL"
    public string Signature { get; set; } = string.Empty;
}

public class LicenseValidationResult
{
    public bool IsValid { get; set; }
    public LicenseStatus Status { get; set; }
    public string Message { get; set; } = string.Empty;
    public LicensePayload? Payload { get; set; }
    public int RemainingDays { get; set; }
    public int RemainingGraceDays { get; set; }
    public bool IsTrial { get; set; }
}
