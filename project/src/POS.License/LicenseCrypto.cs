using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using POS.Domain;

namespace POS.License;

public static class LicenseCrypto
{
    // Internal seed used for HMAC generation and symmetric payload protection
    private static readonly byte[] MasterKey = SHA256.HashData(Encoding.UTF8.GetBytes("SPARK_POS_NATIVE_SECRET_KEY_2026_INDONESIA"));

    // Base date for serial key compact date encoding
    private static readonly DateTime EpochBase = new(2024, 1, 1);

    #region Serial Key Support (SPARK-XXXX-XXXX-XXXX-XXXX)

    /// <summary>
    /// Generates a human-readable 25-character activation key tied to hardware fingerprint
    /// Format: SPARK-EEEE-HHHH-GGGG-CCCC
    /// EEEE: Expiry days hex (from 2024-01-01)
    /// HHHH: Hardware checksum hex
    /// GGGG: Grace period days and edition flags
    /// CCCC: Cryptographic HMAC checksum
    /// </summary>
    public static string GenerateSerialKey(DateTime expiryDate, string hardwareFingerprint, int graceDays = 14)
    {
        int days = Math.Max(0, (int)(expiryDate.Date - EpochBase).TotalDays);
        string expHex = days.ToString("X4");

        string hwChecksum = GetHardwareChecksumHex(hardwareFingerprint);
        string graceHex = graceDays.ToString("X4");

        string rawPayload = $"{expHex}-{hwChecksum}-{graceHex}";
        string checksum = ComputeHmacShort(rawPayload);

        return $"SPARK-{expHex}-{hwChecksum}-{graceHex}-{checksum}";
    }

    /// <summary>
    /// Validates a serial key string against local hardware fingerprint
    /// </summary>
    public static LicenseValidationResult ValidateSerialKey(string serialKey, string currentHardwareFingerprint, DateTime? maxDbTimestamp = null)
    {
        var result = new LicenseValidationResult();

        if (string.IsNullOrWhiteSpace(serialKey))
        {
            result.Status = LicenseStatus.Unregistered;
            result.Message = "Serial key lisensi belum dimasukkan.";
            return result;
        }

        var parts = serialKey.Trim().ToUpperInvariant().Split('-');
        if (parts.Length != 5 || parts[0] != "SPARK")
        {
            result.Status = LicenseStatus.Unregistered;
            result.Message = "Format serial key tidak valid. Contoh: SPARK-03E8-A1B2-000E-7F89";
            return result;
        }

        string expHex = parts[1];
        string hwChecksum = parts[2];
        string graceHex = parts[3];
        string providedChecksum = parts[4];

        // 1. Verify HMAC
        string rawPayload = $"{expHex}-{hwChecksum}-{graceHex}";
        string expectedChecksum = ComputeHmacShort(rawPayload);
        if (!string.Equals(providedChecksum, expectedChecksum, StringComparison.OrdinalIgnoreCase))
        {
            result.Status = LicenseStatus.Tampered;
            result.Message = "Serial key lisensi tidak valid atau telah dimodifikasi (Checksum mismatch).";
            return result;
        }

        // 2. Verify Hardware Binding
        string currentHwChecksum = GetHardwareChecksumHex(currentHardwareFingerprint);
        if (!string.Equals(hwChecksum, currentHwChecksum, StringComparison.OrdinalIgnoreCase) && hwChecksum != "FFFF")
        {
            result.Status = LicenseStatus.InvalidHardware;
            result.Message = "Serial key terdaftar untuk terminal hardware yang berbeda.";
            return result;
        }

        // 3. Decode Expiry & Grace
        if (!int.TryParse(expHex, System.Globalization.NumberStyles.HexNumber, null, out int days))
        {
            result.Status = LicenseStatus.Tampered;
            result.Message = "Data tanggal kedaluwarsa pada serial key rusak.";
            return result;
        }

        if (!int.TryParse(graceHex, System.Globalization.NumberStyles.HexNumber, null, out int graceDays))
        {
            graceDays = 14;
        }

        DateTime expiryDate = EpochBase.AddDays(days);
        var now = DateTime.Now;

        // 4. Anti-Tamper Check (Clock Rollback Detection)
        if (maxDbTimestamp.HasValue && now < maxDbTimestamp.Value.AddMinutes(-5))
        {
            result.Status = LicenseStatus.Tampered;
            result.Message = $"Peringatan manipulasi jam sistem! Jam saat ini ({now:dd/MM/yyyy HH:mm}) lebih mundur dari transaksi terakhir ({maxDbTimestamp.Value:dd/MM/yyyy HH:mm}).";
            return result;
        }

        var payload = new LicensePayload
        {
            ContractId = $"SER-{parts[1]}-{parts[2]}",
            ClientName = "Pengguna Terdaftar",
            OutletName = "Outlet POS Lokal",
            HardwareFingerprint = currentHardwareFingerprint,
            IssueDate = EpochBase,
            ExpiryDate = expiryDate,
            GracePeriodDays = graceDays,
            Features = "STANDARD,OFFLINE_POS,SERIAL_LICENSE",
            FormatType = "SERIAL",
            Signature = providedChecksum
        };

        result.Payload = payload;

        // 5. Evaluate Status (Active, Grace, Expired)
        int remainingDays = (int)Math.Ceiling((expiryDate.Date - now.Date).TotalDays);
        result.RemainingDays = remainingDays;

        if (remainingDays >= 0)
        {
            result.IsValid = true;
            result.Status = LicenseStatus.Active;
            result.Message = $"Lisensi Serial Aktif. Sisa masa aktif: {remainingDays} hari.";
        }
        else
        {
            int daysPastExpiry = Math.Abs(remainingDays);
            int remainingGrace = graceDays - daysPastExpiry;
            result.RemainingGraceDays = Math.Max(0, remainingGrace);

            if (remainingGrace >= 0)
            {
                result.IsValid = true; // Still operational during grace period
                result.Status = LicenseStatus.GracePeriod;
                result.Message = $"Masa aktif sewa telah berakhir. Anda berada dalam masa tenggang (Grace Period): sisa {remainingGrace} hari.";
            }
            else
            {
                result.IsValid = false;
                result.Status = LicenseStatus.Expired;
                result.Message = "Masa sewa dan masa tenggang telah berakhir. Aplikasi dalam mode Read-Only.";
            }
        }

        return result;
    }

    private static string GetHardwareChecksumHex(string hardwareFingerprint)
    {
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(hardwareFingerprint));
        return Convert.ToHexString(hash)[..4].ToUpperInvariant();
    }

    private static string ComputeHmacShort(string input)
    {
        using var hmac = new HMACSHA256(MasterKey);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash)[..4].ToUpperInvariant();
    }

    public static string ComputeHmacSignature(string input)
    {
        using var hmac = new HMACSHA256(MasterKey);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToBase64String(hash);
    }

    #endregion

    #region Encrypted File License Support (.lic)

    /// <summary>
    /// Generates an encrypted .lic payload containing JSON and HMAC signature
    /// </summary>
    public static string GenerateLicenseFileContent(LicensePayload payload)
    {
        // Sign the core properties
        string signatureData = $"{payload.ContractId}|{payload.ClientName}|{payload.HardwareFingerprint}|{payload.ExpiryDate:O}|{payload.GracePeriodDays}";
        using var hmac = new HMACSHA256(MasterKey);
        payload.Signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
        payload.FormatType = "FILE";

        string json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = false });
        byte[] plainBytes = Encoding.UTF8.GetBytes(json);

        // Encrypt with AES-CBC
        using var aes = Aes.Create();
        aes.Key = MasterKey;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
        using var ms = new MemoryStream();
        ms.Write(aes.IV, 0, aes.IV.Length); // prepend IV
        using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
        {
            cs.Write(plainBytes, 0, plainBytes.Length);
            cs.FlushFinalBlock();
        }

        return Convert.ToBase64String(ms.ToArray());
    }

    /// <summary>
    /// Decrypts and validates an encrypted .lic file
    /// </summary>
    public static LicenseValidationResult ValidateLicenseFileContent(string encryptedBase64, string currentHardwareFingerprint, DateTime? maxDbTimestamp = null)
    {
        var result = new LicenseValidationResult();

        if (string.IsNullOrWhiteSpace(encryptedBase64))
        {
            result.Status = LicenseStatus.Unregistered;
            result.Message = "File lisensi kosong atau belum diunggah.";
            return result;
        }

        try
        {
            byte[] cipherWithIv = Convert.FromBase64String(encryptedBase64.Trim());
            if (cipherWithIv.Length < 16)
            {
                result.Status = LicenseStatus.Tampered;
                result.Message = "Data file lisensi tidak valid (panjang kurang).";
                return result;
            }

            byte[] iv = new byte[16];
            Array.Copy(cipherWithIv, 0, iv, 0, 16);
            byte[] cipherText = new byte[cipherWithIv.Length - 16];
            Array.Copy(cipherWithIv, 16, cipherText, 0, cipherText.Length);

            using var aes = Aes.Create();
            aes.Key = MasterKey;
            aes.IV = iv;

            string json;
            using (var decryptor = aes.CreateDecryptor(aes.Key, aes.IV))
            using (var ms = new MemoryStream(cipherText))
            using (var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read))
            using (var reader = new StreamReader(cs, Encoding.UTF8))
            {
                json = reader.ReadToEnd();
            }

            var payload = JsonSerializer.Deserialize<LicensePayload>(json);
            if (payload == null)
            {
                result.Status = LicenseStatus.Tampered;
                result.Message = "Isi file lisensi tidak dapat diproses.";
                return result;
            }

            // Verify signature
            string signatureData = $"{payload.ContractId}|{payload.ClientName}|{payload.HardwareFingerprint}|{payload.ExpiryDate:O}|{payload.GracePeriodDays}";
            using var hmac = new HMACSHA256(MasterKey);
            string expectedSig = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));

            if (!string.Equals(payload.Signature, expectedSig, StringComparison.Ordinal))
            {
                result.Status = LicenseStatus.Tampered;
                result.Message = "Tanda tangan kriptografi file lisensi tidak cocok (telah dimodifikasi).";
                return result;
            }

            // Verify Hardware Binding
            if (!HardwareFingerprint.MatchFingerprint(payload.HardwareFingerprint))
            {
                result.Status = LicenseStatus.InvalidHardware;
                result.Message = $"File lisensi ini terikat ke terminal lain ({payload.HardwareFingerprint}). Terminal ini: {currentHardwareFingerprint}";
                return result;
            }

            result.Payload = payload;
            var now = DateTime.Now;

            // Anti-Tamper Check
            if (maxDbTimestamp.HasValue && now < maxDbTimestamp.Value.AddMinutes(-5))
            {
                result.Status = LicenseStatus.Tampered;
                result.Message = $"Peringatan manipulasi jam sistem! Jam komputer ({now:dd/MM/yyyy HH:mm}) lebih mundur dari catatan database ({maxDbTimestamp.Value:dd/MM/yyyy HH:mm}).";
                return result;
            }

            // Expiry and Grace calculation
            int remainingDays = (int)Math.Ceiling((payload.ExpiryDate.Date - now.Date).TotalDays);
            result.RemainingDays = remainingDays;

            if (remainingDays >= 0)
            {
                result.IsValid = true;
                result.Status = LicenseStatus.Active;
                result.Message = $"Lisensi File Aktif ({payload.ClientName}). Sisa masa aktif: {remainingDays} hari.";
            }
            else
            {
                int daysPastExpiry = Math.Abs(remainingDays);
                int remainingGrace = payload.GracePeriodDays - daysPastExpiry;
                result.RemainingGraceDays = Math.Max(0, remainingGrace);

                if (remainingGrace >= 0)
                {
                    result.IsValid = true;
                    result.Status = LicenseStatus.GracePeriod;
                    result.Message = $"Masa aktif lisensi telah berakhir. Anda berada dalam masa tenggang (Grace Period): sisa {remainingGrace} hari.";
                }
                else
                {
                    result.IsValid = false;
                    result.Status = LicenseStatus.Expired;
                    result.Message = "Masa sewa dan masa tenggang telah berakhir. Aplikasi dalam mode Read-Only.";
                }
            }

            return result;
        }
        catch (Exception ex)
        {
            result.Status = LicenseStatus.Tampered;
            result.Message = $"Gagal memverifikasi file lisensi: {ex.Message}";
            return result;
        }
    }

    #endregion
}
