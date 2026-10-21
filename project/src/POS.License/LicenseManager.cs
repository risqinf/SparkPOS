using System;
using System.IO;
using POS.Domain;

namespace POS.License;

public class LicenseManager
{
    private readonly string _licenseStorageDirectory;
    private readonly string _serialKeyFilePath;
    private readonly string _fileLicenseFilePath;

    private readonly string _trialFilePath;

    public LicenseValidationResult CurrentResult { get; private set; } = new()
    {
        Status = LicenseStatus.Unregistered,
        Message = "Aplikasi belum diaktivasi."
    };

    public string CurrentHardwareFingerprint => HardwareFingerprint.GetCurrentFingerprint();

    public bool HasUsedTrial => File.Exists(_trialFilePath);

    public bool CanTransact => CurrentResult.IsValid && 
                               (CurrentResult.Status == LicenseStatus.Active || CurrentResult.Status == LicenseStatus.GracePeriod);

    public LicenseManager(string? customStorageDir = null)
    {
        _licenseStorageDirectory = customStorageDir ?? 
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SparkPOS", "License");

        Directory.CreateDirectory(_licenseStorageDirectory);
        _serialKeyFilePath = Path.Combine(_licenseStorageDirectory, "spark_license.key");
        _fileLicenseFilePath = Path.Combine(_licenseStorageDirectory, "spark_license.lic");
        _trialFilePath = Path.Combine(_licenseStorageDirectory, "spark_trial.dat");
    }

    /// <summary>
    /// Evaluates current activation status on startup
    /// </summary>
    public LicenseValidationResult EvaluateLicense(DateTime? maxDbTimestamp = null)
    {
        string currentHw = CurrentHardwareFingerprint;

        // 1. Check for .lic file first
        if (File.Exists(_fileLicenseFilePath))
        {
            try
            {
                string encryptedContent = File.ReadAllText(_fileLicenseFilePath);
                CurrentResult = LicenseCrypto.ValidateLicenseFileContent(encryptedContent, currentHw, maxDbTimestamp);
                if (CurrentResult.IsValid)
                    return CurrentResult;
            }
            catch
            {
                // Fallthrough to check serial key
            }
        }

        // 2. Check for Serial Key
        if (File.Exists(_serialKeyFilePath))
        {
            try
            {
                string serial = File.ReadAllText(_serialKeyFilePath).Trim();
                CurrentResult = LicenseCrypto.ValidateSerialKey(serial, currentHw, maxDbTimestamp);
                return CurrentResult;
            }
            catch
            {
                // Fallthrough
            }
        }

        // 3. Check for 30-Day Trial record if no full license is present
        if (File.Exists(_trialFilePath))
        {
            try
            {
                string content = File.ReadAllText(_trialFilePath).Trim();
                var parts = content.Split('|');
                if (parts.Length == 4 && parts[0] == "SPARK_TRIAL")
                {
                    string startIso = parts[1];
                    string hw = parts[2];
                    string sig = parts[3];

                    string expectedSig = LicenseCrypto.ComputeHmacSignature($"SPARK_TRIAL|{startIso}|{hw}");
                    if (string.Equals(sig, expectedSig, StringComparison.Ordinal) &&
                        (string.Equals(hw, currentHw, StringComparison.OrdinalIgnoreCase) || hw == "FFFF"))
                    {
                        if (DateTime.TryParse(startIso, null, System.Globalization.DateTimeStyles.RoundtripKind, out var startDate))
                        {
                            var now = DateTime.Now;
                            // Check anti-tamper clock rollback
                            if (maxDbTimestamp.HasValue && now < maxDbTimestamp.Value.AddMinutes(-5))
                            {
                                CurrentResult = new LicenseValidationResult
                                {
                                    IsValid = false,
                                    Status = LicenseStatus.Tampered,
                                    IsTrial = true,
                                    Message = "Peringatan manipulasi jam terdeteksi! Jam sistem dimundurkan."
                                };
                                return CurrentResult;
                            }

                            var expiry = startDate.AddDays(30);
                            int remainingDays = (int)Math.Ceiling((expiry - now).TotalDays);

                            if (remainingDays > 0)
                            {
                                CurrentResult = new LicenseValidationResult
                                {
                                    IsValid = true,
                                    Status = LicenseStatus.Active,
                                    IsTrial = true,
                                    RemainingDays = remainingDays,
                                    RemainingGraceDays = 0,
                                    Message = $"Mode Percobaan (Trial 30 Hari): Sisa {remainingDays} Hari."
                                };
                                return CurrentResult;
                            }
                            else
                            {
                                CurrentResult = new LicenseValidationResult
                                {
                                    IsValid = false,
                                    Status = LicenseStatus.Expired,
                                    IsTrial = true,
                                    RemainingDays = 0,
                                    RemainingGraceDays = 0,
                                    Message = "Masa Percobaan (Trial 30 Hari) telah berakhir. Transaksi terkunci (Lockdown). Masukkan lisensi resmi dari developer untuk melanjutkan."
                                };
                                return CurrentResult;
                            }
                        }
                    }
                }
            }
            catch
            {
                // Fallthrough
            }
        }

        // Not registered
        CurrentResult = new LicenseValidationResult
        {
            IsValid = false,
            Status = LicenseStatus.Unregistered,
            IsTrial = false,
            Message = "Lisensi belum diaktivasi. Anda dapat mencoba Trial 30 Hari atau memasukkan Serial Key / file .lic resmi."
        };

        return CurrentResult;
    }

    /// <summary>
    /// Starts the one-time 30-day trial for fresh client installations
    /// </summary>
    public LicenseValidationResult StartTrial30Days()
    {
        if (HasUsedTrial)
        {
            return new LicenseValidationResult
            {
                IsValid = false,
                Status = LicenseStatus.Expired,
                IsTrial = true,
                Message = "Masa percobaan 30 hari sudah pernah digunakan pada terminal ini."
            };
        }

        string startIso = DateTime.Now.ToString("O");
        string hw = CurrentHardwareFingerprint;
        string sig = LicenseCrypto.ComputeHmacSignature($"SPARK_TRIAL|{startIso}|{hw}");
        string payload = $"SPARK_TRIAL|{startIso}|{hw}|{sig}";

        File.WriteAllText(_trialFilePath, payload);
        return EvaluateLicense();
    }

    /// <summary>
    /// Activates terminal via 25-character Serial Key
    /// </summary>
    public LicenseValidationResult ActivateWithSerialKey(string serialKey, DateTime? maxDbTimestamp = null)
    {
        var result = LicenseCrypto.ValidateSerialKey(serialKey, CurrentHardwareFingerprint, maxDbTimestamp);
        if (result.Status == LicenseStatus.Active || result.Status == LicenseStatus.GracePeriod || result.Status == LicenseStatus.Expired)
        {
            File.WriteAllText(_serialKeyFilePath, serialKey.Trim());
            // Remove old file license if switching to serial
            if (File.Exists(_fileLicenseFilePath))
                File.Delete(_fileLicenseFilePath);

            CurrentResult = result;
        }

        return result;
    }

    /// <summary>
    /// Activates terminal via .lic license file
    /// </summary>
    public LicenseValidationResult ActivateWithLicenseFile(string sourceFilePath, DateTime? maxDbTimestamp = null)
    {
        if (!File.Exists(sourceFilePath))
        {
            return new LicenseValidationResult
            {
                IsValid = false,
                Status = LicenseStatus.Unregistered,
                Message = $"File lisensi tidak ditemukan di path: {sourceFilePath}"
            };
        }

        string encryptedContent = File.ReadAllText(sourceFilePath);
        var result = LicenseCrypto.ValidateLicenseFileContent(encryptedContent, CurrentHardwareFingerprint, maxDbTimestamp);

        if (result.Status == LicenseStatus.Active || result.Status == LicenseStatus.GracePeriod || result.Status == LicenseStatus.Expired)
        {
            File.WriteAllText(_fileLicenseFilePath, encryptedContent);
            // Remove old serial key if switching to file
            if (File.Exists(_serialKeyFilePath))
                File.Delete(_serialKeyFilePath);

            CurrentResult = result;
        }

        return result;
    }

    /// <summary>
    /// Generates and installs a demo 30-day license for immediate testing
    /// </summary>
    public LicenseValidationResult GenerateAndApplyDemoLicense(int days = 30)
    {
        var expiry = DateTime.Now.AddDays(days);
        string serial = LicenseCrypto.GenerateSerialKey(expiry, CurrentHardwareFingerprint, graceDays: 14);
        return ActivateWithSerialKey(serial);
    }
}
