using System;
using System.Linq;
using System.Threading.Tasks;
using POS.Domain;

namespace POS.Application;

public class ShiftService
{
    private readonly IShiftRepository _shiftRepo;
    private readonly ITransactionRepository _txRepo;

    public Shift? CurrentShift { get; private set; }

    public ShiftService(IShiftRepository shiftRepo, ITransactionRepository txRepo)
    {
        _shiftRepo = shiftRepo;
        _txRepo = txRepo;
    }

    public async Task<Shift?> LoadActiveShiftAsync(int employeeId)
    {
        CurrentShift = await _shiftRepo.GetActiveShiftAsync(employeeId);
        return CurrentShift;
    }

    public async Task<Shift> OpenShiftAsync(int employeeId, string employeeName, decimal openingCash)
    {
        var shift = new Shift
        {
            EmployeeId = employeeId,
            EmployeeName = employeeName,
            StartTime = DateTime.Now,
            OpeningCash = openingCash,
            ExpectedCash = openingCash,
            IsClosed = false
        };

        int id = await _shiftRepo.OpenShiftAsync(shift);
        shift.Id = id;
        CurrentShift = shift;
        return shift;
    }

    public async Task<(decimal ExpectedCash, decimal TotalCashSales, decimal TotalNonCashSales, int TransactionCount)> CalculateShiftSummaryAsync(int shiftId)
    {
        var shift = await _shiftRepo.GetByIdAsync(shiftId);
        if (shift == null) return (0, 0, 0, 0);

        var transactions = (await _txRepo.GetByShiftAsync(shiftId))
            .Where(t => t.Status == TransactionStatus.Completed)
            .ToList();

        var logs = await _shiftRepo.GetCashDrawerLogsAsync(shiftId);
        decimal cashIn = logs.Where(l => l.Type == "CASH_IN").Sum(l => l.Amount);
        decimal cashOut = logs.Where(l => l.Type == "CASH_OUT").Sum(l => l.Amount);

        decimal totalCashSales = 0;
        decimal totalNonCashSales = 0;

        foreach (var tx in transactions)
        {
            foreach (var p in tx.Payments)
            {
                if (p.Method == PaymentMethod.Cash)
                {
                    // Net cash received = Paid cash - change (if fully cash) or p.Amount
                    totalCashSales += (p.Amount - tx.ChangeAmount);
                }
                else
                {
                    totalNonCashSales += p.Amount;
                }
            }
        }

        decimal expectedCash = shift.OpeningCash + totalCashSales + cashIn - cashOut;
        return (expectedCash, totalCashSales, totalNonCashSales, transactions.Count);
    }

    public async Task<Shift> CloseShiftAsync(int shiftId, decimal countedClosingCash, string note)
    {
        var shift = await _shiftRepo.GetByIdAsync(shiftId);
        if (shift == null)
            throw new InvalidOperationException("Shift tidak ditemukan.");

        var (expectedCash, _, _, _) = await CalculateShiftSummaryAsync(shiftId);

        shift.EndTime = DateTime.Now;
        shift.ClosingCash = countedClosingCash;
        shift.ExpectedCash = expectedCash;
        shift.Discrepancy = countedClosingCash - expectedCash;
        shift.Note = note;
        shift.IsClosed = true;

        await _shiftRepo.CloseShiftAsync(shift);
        if (CurrentShift?.Id == shiftId)
            CurrentShift = null;

        return shift;
    }

    public async Task RecordCashDrawerMovementAsync(int shiftId, string type, decimal amount, string reason)
    {
        var log = new CashDrawerLog
        {
            ShiftId = shiftId,
            Timestamp = DateTime.Now,
            Type = type,
            Amount = amount,
            Reason = reason
        };

        await _shiftRepo.AddCashDrawerLogAsync(log);
    }
}
