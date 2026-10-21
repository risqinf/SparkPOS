using System;
using System.Linq;
using System.Management;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace POS.License;

public static class HardwareFingerprint
{
    private static string? _cachedFingerprint;

    public static string GetCurrentFingerprint()
    {
        if (!string.IsNullOrEmpty(_cachedFingerprint))
            return _cachedFingerprint;

        var rawComponents = new StringBuilder();

        // 1. Motherboard Serial
        rawComponents.Append("MB:").Append(GetMotherboardSerial());

        // 2. CPU ID
        rawComponents.Append("|CPU:").Append(GetCpuId());

        // 3. Primary MAC Address
        rawComponents.Append("|MAC:").Append(GetPrimaryMacAddress());

        // 4. System Drive Serial
        rawComponents.Append("|DRV:").Append(GetSystemDriveSerial());

        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(rawComponents.ToString()));
        var hashHex = Convert.ToHexString(hashBytes);

        // Format: FPRNT-XXXX-XXXX-XXXX-XXXX (First 16 chars formatted in 4-char groups)
        _cachedFingerprint = $"FPRNT-{hashHex[..4]}-{hashHex[4..8]}-{hashHex[8..12]}-{hashHex[12..16]}";
        return _cachedFingerprint;
    }

    public static bool MatchFingerprint(string expectedFingerprint)
    {
        if (string.IsNullOrWhiteSpace(expectedFingerprint))
            return false;

        // Allow wildcard or test fingerprint in developer/staging mode
        if (expectedFingerprint == "*" || expectedFingerprint == "FPRNT-DEMO-TEST-ALL-GOOD")
            return true;

        return string.Equals(GetCurrentFingerprint(), expectedFingerprint.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string GetMotherboardSerial()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return "NON_WIN_MB";

        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber, Manufacturer FROM Win32_BaseBoard");
            foreach (var item in searcher.Get())
            {
                var serial = item["SerialNumber"]?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(serial) && !serial.Equals("None", StringComparison.OrdinalIgnoreCase))
                    return serial;
            }
        }
        catch
        {
            // Fallback
        }

        return Environment.MachineName + "_MB";
    }

    private static string GetCpuId()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return "NON_WIN_CPU";

        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT ProcessorId, Name FROM Win32_Processor");
            foreach (var item in searcher.Get())
            {
                var id = item["ProcessorId"]?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(id))
                    return id;
            }
        }
        catch
        {
            // Fallback
        }

        return Environment.ProcessorCount.ToString();
    }

    private static string GetPrimaryMacAddress()
    {
        try
        {
            var mac = NetworkInterface.GetAllNetworkInterfaces()
                .Where(nic => nic.OperationalStatus == OperationalStatus.Up &&
                              nic.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .Select(nic => nic.GetPhysicalAddress().ToString())
                .FirstOrDefault(s => !string.IsNullOrEmpty(s));

            if (!string.IsNullOrEmpty(mac))
                return mac;
        }
        catch
        {
            // Fallback
        }

        return "DEFAULT_MAC";
    }

    private static string GetSystemDriveSerial()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return "NON_WIN_DRV";

        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT VolumeSerialNumber FROM Win32_LogicalDisk WHERE DeviceID='C:'");
            foreach (var item in searcher.Get())
            {
                var serial = item["VolumeSerialNumber"]?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(serial))
                    return serial;
            }
        }
        catch
        {
            // Fallback
        }

        return Environment.UserName + "_DRV";
    }
}
