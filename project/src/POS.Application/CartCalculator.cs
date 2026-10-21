using System;
using System.Collections.Generic;
using System.Linq;
using POS.Domain;

namespace POS.Application;

public class CartSummary
{
    public decimal SubTotal { get; set; }
    public decimal DiscountItemTotal { get; set; }
    public decimal DiscountOrderAmount { get; set; }
    public decimal TaxPercent { get; set; }
    public decimal TaxAmount { get; set; }
    public bool IsTaxInclusive { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal TotalItemCount { get; set; }
}

public static class CartCalculator
{
    /// <summary>
    /// Calculates a single line item subtotal: (Price * Qty) - Discount
    /// </summary>
    public static decimal CalculateLineSubtotal(decimal unitPrice, decimal quantity, decimal discountAmount)
    {
        decimal gross = unitPrice * quantity;
        decimal subtotal = Math.Max(0, gross - discountAmount);
        return subtotal;
    }

    /// <summary>
    /// Computes full financial breakdown for the active cart
    /// </summary>
    public static CartSummary Calculate(
        IEnumerable<TransactionDetail> items,
        decimal orderDiscountPercent,
        decimal orderDiscountNominal,
        decimal taxPercent,
        bool isTaxInclusive)
    {
        var summary = new CartSummary
        {
            TaxPercent = taxPercent,
            IsTaxInclusive = isTaxInclusive
        };

        var itemList = items.ToList();
        if (itemList.Count == 0)
            return summary;

        decimal subtotal = 0;
        decimal discountItemTotal = 0;
        decimal totalQty = 0;

        foreach (var item in itemList)
        {
            totalQty += item.Quantity;
            discountItemTotal += item.DiscountAmount;
            decimal lineSub = CalculateLineSubtotal(item.UnitPrice, item.Quantity, item.DiscountAmount);
            item.Subtotal = lineSub;
            subtotal += lineSub;
        }

        summary.SubTotal = subtotal;
        summary.DiscountItemTotal = discountItemTotal;
        summary.TotalItemCount = totalQty;

        // Order-level discount
        decimal orderDiscount = 0;
        if (orderDiscountPercent > 0)
        {
            orderDiscount = Math.Round((subtotal * (orderDiscountPercent / 100m)), 0);
        }
        else if (orderDiscountNominal > 0)
        {
            orderDiscount = Math.Min(subtotal, orderDiscountNominal);
        }

        summary.DiscountOrderAmount = orderDiscount;
        decimal baseAfterOrderDiscount = Math.Max(0, subtotal - orderDiscount);

        // Tax Calculation (PPN / PB1)
        decimal taxAmount = 0;
        if (taxPercent > 0)
        {
            if (isTaxInclusive)
            {
                // Tax included in price: Tax = Base - (Base / (1 + Rate))
                taxAmount = Math.Round(baseAfterOrderDiscount - (baseAfterOrderDiscount / (1m + (taxPercent / 100m))), 0);
                summary.GrandTotal = baseAfterOrderDiscount;
            }
            else
            {
                // Tax added to price: Tax = Base * Rate
                taxAmount = Math.Round(baseAfterOrderDiscount * (taxPercent / 100m), 0);
                summary.GrandTotal = baseAfterOrderDiscount + taxAmount;
            }
        }
        else
        {
            summary.GrandTotal = baseAfterOrderDiscount;
        }

        summary.TaxAmount = taxAmount;
        return summary;
    }

    /// <summary>
    /// Calculates change and validates if paid amount covers grand total
    /// </summary>
    public static (bool IsSufficient, decimal Change) CalculateChange(decimal grandTotal, decimal paidAmount)
    {
        decimal diff = paidAmount - grandTotal;
        if (diff >= 0)
        {
            return (true, diff);
        }
        return (false, 0);
    }
}
