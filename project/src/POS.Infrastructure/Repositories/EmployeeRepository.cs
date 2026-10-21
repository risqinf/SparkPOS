using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using POS.Domain;

namespace POS.Infrastructure.Repositories;

public class EmployeeRepository : IEmployeeRepository
{
    private readonly DatabaseContext _context;

    public EmployeeRepository(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<Employee?> GetByIdAsync(int id)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Employee>(
            "SELECT * FROM Employees WHERE Id = @Id", new { Id = id });
    }

    public async Task<Employee?> GetByUsernameAsync(string username)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Employee>(
            "SELECT * FROM Employees WHERE LOWER(Username) = LOWER(@Username) AND IsActive = 1", new { Username = username.Trim() });
    }

    public async Task<Employee?> AuthenticateAsync(string username, string pin)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Employee>(@"
            SELECT * FROM Employees 
            WHERE LOWER(Username) = LOWER(@Username) AND Pin = @Pin AND IsActive = 1", 
            new { Username = username.Trim(), Pin = pin.Trim() });
    }

    public async Task<Employee?> AuthenticatePinOnlyAsync(string pin)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Employee>(@"
            SELECT * FROM Employees 
            WHERE Pin = @Pin AND IsActive = 1 LIMIT 1", new { Pin = pin.Trim() });
    }

    public async Task<IEnumerable<Employee>> GetAllAsync()
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Employee>("SELECT * FROM Employees ORDER BY Role DESC, FullName ASC");
    }

    public async Task<int> CreateAsync(Employee employee)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            INSERT INTO Employees (Username, FullName, Pin, Role, IsActive, CreatedAt)
            VALUES (@Username, @FullName, @Pin, @Role, @IsActive, @CreatedAt);
            SELECT last_insert_rowid();";

        int id = await conn.ExecuteScalarAsync<int>(sql, new {
            employee.Username,
            employee.FullName,
            employee.Pin,
            Role = (int)employee.Role,
            employee.IsActive,
            CreatedAt = employee.CreatedAt.ToString("O")
        });

        employee.Id = id;
        return id;
    }

    public async Task<bool> UpdateAsync(Employee employee)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            UPDATE Employees SET
                Username = @Username,
                FullName = @FullName,
                Pin = @Pin,
                Role = @Role,
                IsActive = @IsActive
            WHERE Id = @Id";

        int rows = await conn.ExecuteAsync(sql, new {
            employee.Username,
            employee.FullName,
            employee.Pin,
            Role = (int)employee.Role,
            employee.IsActive,
            employee.Id
        });

        return rows > 0;
    }
}
