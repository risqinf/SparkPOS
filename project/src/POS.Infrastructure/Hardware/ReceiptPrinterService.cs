using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using POS.Domain;

namespace POS.Infrastructure.Hardware;

public class ReceiptPrinterService
{
    public static byte[] KickCashDrawerBytes => new byte[] { 0x1B, 0x70, 0x00, 0x19, 0xFA };
    public static byte[] PaperCutBytes => new byte[] { 0x1D, 0x56, 0x41, 0x10 };

    /// <summary>
    /// Generates cleanly formatted monospace receipt text for 58mm (32 cols) or 80mm (48 cols)
    /// </summary>
    public static string FormatReceiptText(Transaction tx, StoreProfile profile, int columns = 40)
    {
        var sb = new StringBuilder();
        string divider = new('-', columns);
        string doubleDivider = new('=', columns);

        // Header
        NormalizeAndAppendCentered(sb, profile.StoreName.ToUpperInvariant(), columns);
        if (!string.IsNullOrEmpty(profile.BranchName))
            NormalizeAndAppendCentered(sb, profile.BranchName, columns);
        NormalizeAndAppendCentered(sb, profile.Address, columns);
        NormalizeAndAppendCentered(sb, $"Telp: {profile.Phone}", columns);
        sb.AppendLine(doubleDivider);

        // Metadata
        sb.AppendLine($"No. Nota : {tx.InvoiceNumber}");
        sb.AppendLine($"Waktu    : {tx.CreatedAt:dd/MM/yyyy HH:mm}");
        sb.AppendLine($"Kasir    : {tx.CashierName}");
        if (!string.IsNullOrEmpty(tx.CustomerName))
            sb.AppendLine($"Pelanggan: {tx.CustomerName}");
        sb.AppendLine(divider);

        // Line Items
        foreach (var item in tx.Details)
        {
            sb.AppendLine(item.ProductName);
            string left = $" {item.Quantity:N0} x Rp {item.UnitPrice:N0}";
            if (item.DiscountAmount > 0)
                left += $" (-Rp {item.DiscountAmount:N0})";

            string right = $"Rp {item.Subtotal:N0}";
            sb.AppendLine(PadBetween(left, right, columns));
        }

        sb.AppendLine(divider);

        // Financial Totals
        sb.AppendLine(PadBetween("Subtotal:", $"Rp {tx.SubTotal:N0}", columns));

        if (tx.DiscountOrderAmount > 0)
        {
            string discLabel = tx.DiscountOrderPercent > 0 
                ? $"Diskon Nota ({tx.DiscountOrderPercent:0.#}%):" 
                : "Diskon Nota:";
            sb.AppendLine(PadBetween(discLabel, $"-Rp {tx.DiscountOrderAmount:N0}", columns));
        }

        if (tx.TaxAmount > 0)
        {
            string taxLabel = tx.IsTaxInclusive 
                ? $"Termasuk PPN ({tx.TaxPercent:0.#}%):" 
                : $"PPN ({tx.TaxPercent:0.#}%):";
            sb.AppendLine(PadBetween(taxLabel, $"Rp {tx.TaxAmount:N0}", columns));
        }

        sb.AppendLine(doubleDivider);
        sb.AppendLine(PadBetween("TOTAL AKHIR:", $"Rp {tx.GrandTotal:N0}", columns));

        // Payments
        foreach (var p in tx.Payments)
        {
            string methodStr = p.Method switch
            {
                PaymentMethod.Cash => "TUNAI",
                PaymentMethod.Qris => "QRIS",
                PaymentMethod.Debit => "KARTU DEBIT",
                PaymentMethod.Credit => "KARTU KREDIT",
                _ => "LAINNYA"
            };
            sb.AppendLine(PadBetween($"Bayar ({methodStr}):", $"Rp {p.Amount:N0}", columns));
        }

        if (tx.ChangeAmount > 0)
        {
            sb.AppendLine(PadBetween("KEMBALIAN:", $"Rp {tx.ChangeAmount:N0}", columns));
        }

        sb.AppendLine(doubleDivider);

        // Footer - Resolves literal \n splitting bug reported by user
        if (!string.IsNullOrEmpty(profile.ReceiptFooter))
        {
            NormalizeAndAppendCentered(sb, profile.ReceiptFooter, columns);
        }

        sb.AppendLine();
        sb.AppendLine();

        return sb.ToString();
    }

    /// <summary>
    /// Generates raw ESC/POS byte array ready to be sent to physical printer
    /// </summary>
    public static byte[] GenerateEscPosBytes(Transaction tx, StoreProfile profile, bool kickDrawer = true)
    {
        using var ms = new MemoryStream();

        // Init printer
        ms.Write(new byte[] { 0x1B, 0x40 });

        if (kickDrawer)
            ms.Write(KickCashDrawerBytes);

        // Text content
        string text = FormatReceiptText(tx, profile, 40);
        byte[] textBytes = Encoding.GetEncoding("ASCII").GetBytes(text.Replace("Rp ", "Rp."));
        ms.Write(textBytes);

        // Cut
        ms.Write(PaperCutBytes);

        return ms.ToArray();
    }

    private static string Center(string text, int width)
    {
        if (text.Length >= width) return text;
        int leftPadding = (width - text.Length) / 2;
        return text.PadLeft(leftPadding + text.Length).PadRight(width);
    }

    private static string PadBetween(string left, string right, int width)
    {
        int spaces = width - left.Length - right.Length;
        if (spaces <= 0) return $"{left} {right}";
        return left + new string(' ', spaces) + right;
    }

    private static void NormalizeAndAppendCentered(StringBuilder sb, string rawText, int columns)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return;

        // Unescape literal \r\n and \n that might come from JSON, DB seeds or single-line text inputs
        string normalized = rawText
            .Replace("\\r\\n", "\n")
            .Replace("\\n", "\n")
            .Replace("\r\n", "\n")
            .Replace("\r", "\n");

        var lines = normalized.Split('\n', StringSplitOptions.None);
        foreach (var line in lines)
        {
            string trimmed = line.Trim();
            if (!string.IsNullOrEmpty(trimmed))
            {
                sb.AppendLine(Center(trimmed, columns));
            }
        }
    }

    /// <summary>
    /// Classifies printer into standard POS paper width category based on printer name heuristics
    /// </summary>
    public static (int Columns, string TypeDescription) ClassifyPrinterType(string printerName)
    {
        if (string.IsNullOrWhiteSpace(printerName))
            return (42, "Standard POS (80mm)");

        string lower = printerName.ToLowerInvariant();

        // 58mm Mini POS Thermal Printers
        if (lower.Contains("58") || lower.Contains("mini") || lower.Contains("zj-58") || lower.Contains("pos-58") || lower.Contains("mpt-ii"))
        {
            return (32, "Mini Kasir Thermal (58mm)");
        }

        // Standard 80mm Thermal Receipt Printers (Epson TM-T82, TM-T88, Star, Bixolon, etc)
        if (lower.Contains("80") || lower.Contains("tm-t") || lower.Contains("t82") || lower.Contains("t88") ||
            lower.Contains("star") || lower.Contains("bixolon") || lower.Contains("pos-80") || lower.Contains("receipt") || lower.Contains("thermal"))
        {
            return (42, "POS Kasir Thermal (80mm EPSON Standard)");
        }

        // Standard Desktop Printers (A4 / Inkjet / Laserjet / PDF / XPS)
        if (lower.Contains("pdf") || lower.Contains("xps") || lower.Contains("canon") || lower.Contains("hp") ||
            lower.Contains("epson l") || lower.Contains("ecotank") || lower.Contains("laserjet") || lower.Contains("deskjet"))
        {
            return (56, "Printer Dokumen / Desktop (A4)");
        }

        return (42, "Printer POS (80mm)");
    }
}
