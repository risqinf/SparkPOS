using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using POS.Domain;

namespace POS.Infrastructure.Repositories;

public class ShiftRepository : IShiftRepository
{
    private readonly DatabaseContext _context;

    public ShiftRepository(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<Shift?> GetActiveShiftAsync(int employeeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Shift>(@"
            SELECT * FROM Shifts 
            WHERE EmployeeId = @EmpId AND IsClosed = 0 
            ORDER BY StartTime DESC LIMIT 1", new { EmpId = employeeId });
    }

    public async Task<Shift?> GetByIdAsync(int id)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Shift>(
            "SELECT * FROM Shifts WHERE Id = @Id", new { Id = id });
    }

    public async Task<IEnumerable<Shift>> GetRecentShiftsAsync(int limit = 30)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Shift>(
            "SELECT * FROM Shifts ORDER BY StartTime DESC LIMIT @Limit", new { Limit = limit });
    }

    public async Task<int> OpenShiftAsync(Shift shift)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            INSERT INTO Shifts (EmployeeId, EmployeeName, StartTime, OpeningCash, ExpectedCash, IsClosed)
            VALUES (@EmployeeId, @EmployeeName, @StartTime, @OpeningCash, @OpeningCash, 0);
            SELECT last_insert_rowid();";

        int id = await conn.ExecuteScalarAsync<int>(sql, new {
            shift.EmployeeId,
            shift.EmployeeName,
            StartTime = shift.StartTime.ToString("O"),
            shift.OpeningCash
        });

        shift.Id = id;
        return id;
    }

    public async Task<bool> CloseShiftAsync(Shift shift)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            UPDATE Shifts SET
                EndTime = @EndTime,
                ClosingCash = @ClosingCash,
                ExpectedCash = @ExpectedCash,
                Discrepancy = @Discrepancy,
                Note = @Note,
                IsClosed = 1
            WHERE Id = @Id";

        int rows = await conn.ExecuteAsync(sql, new {
            EndTime = shift.EndTime?.ToString("O") ?? DateTime.Now.ToString("O"),
            shift.ClosingCash,
            shift.ExpectedCash,
            shift.Discrepancy,
            shift.Note,
            shift.Id
        });

        return rows > 0;
    }

    public async Task<int> AddCashDrawerLogAsync(CashDrawerLog log)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            INSERT INTO CashDrawerLogs (ShiftId, Timestamp, Type, Amount, Reason)
            VALUES (@ShiftId, @Timestamp, @Type, @Amount, @Reason);
            SELECT last_insert_rowid();";

        int id = await conn.ExecuteScalarAsync<int>(sql, new {
            log.ShiftId,
            Timestamp = log.Timestamp.ToString("O"),
            log.Type,
            log.Amount,
            log.Reason
        });

        log.Id = id;
        return id;
    }

    public async Task<IEnumerable<CashDrawerLog>> GetCashDrawerLogsAsync(int shiftId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<CashDrawerLog>(
            "SELECT * FROM CashDrawerLogs WHERE ShiftId = @ShiftId ORDER BY Timestamp ASC", 
            new { ShiftId = shiftId });
    }

    public async Task<DateTime?> GetMaxShiftDateAsync()
    {
        using var conn = _context.CreateConnection();
        string? maxStr = await conn.ExecuteScalarAsync<string>(
            "SELECT MAX(StartTime) FROM Shifts");

        if (string.IsNullOrEmpty(maxStr))
            return null;

        if (DateTime.TryParse(maxStr, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
            return dt;

        return null;
    }
}
