using System.Collections.Generic;
using POS.Application;
using POS.Domain;
using Xunit;

namespace POS.Tests;

public class CartCalculatorTests
{
    [Fact]
    public void CalculateLineSubtotal_ReturnsCorrectValue()
    {
        decimal price = 36500;
        decimal qty = 2;
        decimal discount = 3000;

        decimal subtotal = CartCalculator.CalculateLineSubtotal(price, qty, discount);
        // (36500 * 2) - 3000 = 70000
        Assert.Equal(70000, subtotal);
    }

    [Fact]
    public void CalculateCart_ExclusiveTax_CalculatesTaxCorrectly()
    {
        var items = new List<TransactionDetail>
        {
            new() { UnitPrice = 10000, Quantity = 2, DiscountAmount = 0 }, // 20.000
            new() { UnitPrice = 50000, Quantity = 1, DiscountAmount = 0 }  // 50.000
        };

        // Subtotal = 70.000, Tax 11% Exclusive
        var summary = CartCalculator.Calculate(items, orderDiscountPercent: 0, orderDiscountNominal: 0, taxPercent: 11, isTaxInclusive: false);

        Assert.Equal(70000, summary.SubTotal);
        Assert.Equal(7700, summary.TaxAmount); // 70000 * 0.11 = 7700
        Assert.Equal(77700, summary.GrandTotal); // 70000 + 7700 = 77700
    }

    [Fact]
    public void CalculateCart_InclusiveTax_CalculatesTaxInsidePrice()
    {
        var items = new List<TransactionDetail>
        {
            new() { UnitPrice = 111000, Quantity = 1, DiscountAmount = 0 }
        };

        // Subtotal = 111.000, Tax 11% Inclusive
        var summary = CartCalculator.Calculate(items, orderDiscountPercent: 0, orderDiscountNominal: 0, taxPercent: 11, isTaxInclusive: true);

        Assert.Equal(111000, summary.SubTotal);
        Assert.Equal(111000, summary.GrandTotal); // Grand total remains 111000
        Assert.Equal(11000, summary.TaxAmount);   // 111000 - (111000 / 1.11) = 11000
    }

    [Fact]
    public void CalculateCart_WithOrderDiscount_AppliesDiscountBeforeTax()
    {
        var items = new List<TransactionDetail>
        {
            new() { UnitPrice = 100000, Quantity = 1, DiscountAmount = 0 }
        };

        // 10% order discount on 100.000 -> 90.000. Tax 11% exclusive -> 9.900. Grand total = 99.900
        var summary = CartCalculator.Calculate(items, orderDiscountPercent: 10, orderDiscountNominal: 0, taxPercent: 11, isTaxInclusive: false);

        Assert.Equal(100000, summary.SubTotal);
        Assert.Equal(10000, summary.DiscountOrderAmount);
        Assert.Equal(9900, summary.TaxAmount);
        Assert.Equal(99900, summary.GrandTotal);
    }

    [Fact]
    public void CalculateChange_PaidAmountSufficient_ReturnsPositiveChange()
    {
        decimal grandTotal = 75000;
        decimal paid = 100000;

        var (isSufficient, change) = CartCalculator.CalculateChange(grandTotal, paid);

        Assert.True(isSufficient);
        Assert.Equal(25000, change);
    }

    [Fact]
    public void CalculateChange_PaidAmountInsufficient_ReturnsFalse()
    {
        decimal grandTotal = 75000;
        decimal paid = 50000;

        var (isSufficient, change) = CartCalculator.CalculateChange(grandTotal, paid);

        Assert.False(isSufficient);
        Assert.Equal(0, change);
    }
}
