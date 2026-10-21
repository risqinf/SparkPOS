using System;
using System.IO;
using POS.Domain;
using POS.License;
using Xunit;

namespace POS.Tests;

public class LicenseTests
{
    [Fact]
    public void HardwareFingerprint_ReturnsConsistentFormat()
    {
        string fp1 = HardwareFingerprint.GetCurrentFingerprint();
        string fp2 = HardwareFingerprint.GetCurrentFingerprint();

        Assert.NotNull(fp1);
        Assert.StartsWith("FPRNT-", fp1);
        Assert.Equal(fp1, fp2);
    }

    [Fact]
    public void SerialKey_ValidKey_ActivatesSuccessfully()
    {
        string hw = HardwareFingerprint.GetCurrentFingerprint();
        var expiry = DateTime.Now.AddDays(30);

        string serial = LicenseCrypto.GenerateSerialKey(expiry, hw, graceDays: 14);
        var result = LicenseCrypto.ValidateSerialKey(serial, hw);

        Assert.True(result.IsValid);
        Assert.Equal(LicenseStatus.Active, result.Status);
        Assert.True(result.RemainingDays >= 29);
        Assert.NotNull(result.Payload);
    }

    [Fact]
    public void SerialKey_WrongHardware_ReturnsInvalidHardware()
    {
        string registeredHw = "FPRNT-1111-2222-3333-4444";
        string currentHw = "FPRNT-9999-8888-7777-6666";
        var expiry = DateTime.Now.AddDays(30);

        string serial = LicenseCrypto.GenerateSerialKey(expiry, registeredHw, graceDays: 14);
        var result = LicenseCrypto.ValidateSerialKey(serial, currentHw);

        Assert.False(result.IsValid);
        Assert.Equal(LicenseStatus.InvalidHardware, result.Status);
    }

    [Fact]
    public void SerialKey_ExpiredWithinGracePeriod_ReturnsGracePeriod()
    {
        string hw = HardwareFingerprint.GetCurrentFingerprint();
        var expiry = DateTime.Now.AddDays(-3); // Expired 3 days ago

        string serial = LicenseCrypto.GenerateSerialKey(expiry, hw, graceDays: 14);
        var result = LicenseCrypto.ValidateSerialKey(serial, hw);

        // Within grace period (14 - 3 = 11 days remaining)
        Assert.True(result.IsValid);
        Assert.Equal(LicenseStatus.GracePeriod, result.Status);
        Assert.Equal(11, result.RemainingGraceDays);
    }

    [Fact]
    public void SerialKey_ExpiredBeyondGracePeriod_ReturnsExpired()
    {
        string hw = HardwareFingerprint.GetCurrentFingerprint();
        var expiry = DateTime.Now.AddDays(-20); // Expired 20 days ago

        string serial = LicenseCrypto.GenerateSerialKey(expiry, hw, graceDays: 14);
        var result = LicenseCrypto.ValidateSerialKey(serial, hw);

        Assert.False(result.IsValid);
        Assert.Equal(LicenseStatus.Expired, result.Status);
    }

    [Fact]
    public void SerialKey_ClockRollback_DetectsTampering()
    {
        string hw = HardwareFingerprint.GetCurrentFingerprint();
        var expiry = DateTime.Now.AddDays(30);
        string serial = LicenseCrypto.GenerateSerialKey(expiry, hw, graceDays: 14);

        // Suppose database recorded a transaction in the future (e.g. user set clock back)
        DateTime futureDbTime = DateTime.Now.AddHours(2);
        var result = LicenseCrypto.ValidateSerialKey(serial, hw, maxDbTimestamp: futureDbTime);

        Assert.False(result.IsValid);
        Assert.Equal(LicenseStatus.Tampered, result.Status);
        Assert.Contains("Peringatan manipulasi jam sistem", result.Message);
    }

    [Fact]
    public void LicenseFile_GenerateAndValidate_Succeeds()
    {
        string hw = HardwareFingerprint.GetCurrentFingerprint();
        var payload = new LicensePayload
        {
            ContractId = "RENT-JKT-882190",
            ClientName = "Toko Berkah Jaya",
            OutletName = "Cabang Utama",
            HardwareFingerprint = hw,
            IssueDate = DateTime.Now,
            ExpiryDate = DateTime.Now.AddDays(45),
            GracePeriodDays = 14,
            Features = "STANDARD,OFFLINE_POS,RETAIL_PRO"
        };

        string encrypted = LicenseCrypto.GenerateLicenseFileContent(payload);
        Assert.False(string.IsNullOrWhiteSpace(encrypted));

        var result = LicenseCrypto.ValidateLicenseFileContent(encrypted, hw);

        Assert.True(result.IsValid);
        Assert.Equal(LicenseStatus.Active, result.Status);
        Assert.Equal("Toko Berkah Jaya", result.Payload?.ClientName);
        Assert.Equal("RENT-JKT-882190", result.Payload?.ContractId);
    }

    [Fact]
    public void LicenseManager_DualFormatActivation_SavesAndEvaluates()
    {
        string tempDir = Path.Combine(Path.GetTempPath(), "SparkPOSTest_" + Guid.NewGuid().ToString("N"));
        try
        {
            var manager = new LicenseManager(tempDir);
            Assert.False(manager.CanTransact);
            Assert.Equal(LicenseStatus.Unregistered, manager.CurrentResult.Status);

            // Test 1: Activate with Serial Key
            var result = manager.GenerateAndApplyDemoLicense(30);
            Assert.True(result.IsValid);
            Assert.True(manager.CanTransact);
            Assert.Equal(LicenseStatus.Active, manager.CurrentResult.Status);

            // Test reload from disk
            var reloadedManager = new LicenseManager(tempDir);
            var reloadedResult = reloadedManager.EvaluateLicense();
            Assert.True(reloadedResult.IsValid);
            Assert.True(reloadedManager.CanTransact);

            // Test 2: Activate with .lic file
            var filePayload = new LicensePayload
            {
                ContractId = "RENT-JKT-FILE-01",
                ClientName = "Toko Demo File",
                OutletName = "Cabang 1",
                HardwareFingerprint = manager.CurrentHardwareFingerprint,
                IssueDate = DateTime.Now,
                ExpiryDate = DateTime.Now.AddDays(60),
                GracePeriodDays = 14
            };
            string licContent = LicenseCrypto.GenerateLicenseFileContent(filePayload);
            string tempLicPath = Path.Combine(tempDir, "incoming.lic");
            File.WriteAllText(tempLicPath, licContent);

            var fileResult = manager.ActivateWithLicenseFile(tempLicPath);
            Assert.True(fileResult.IsValid);
            Assert.Equal(LicenseStatus.Active, fileResult.Status);
            Assert.Equal("RENT-JKT-FILE-01", fileResult.Payload?.ContractId);
        }
        finally
        {
            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, true);
        }
    }
}
