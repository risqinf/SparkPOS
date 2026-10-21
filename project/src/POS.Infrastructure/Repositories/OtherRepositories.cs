using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using POS.Domain;

namespace POS.Infrastructure.Repositories;

public class CategoryRepository : ICategoryRepository
{
    private readonly DatabaseContext _context;

    public CategoryRepository(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Category>> GetAllAsync()
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Category>("SELECT * FROM Categories ORDER BY Name ASC");
    }

    public async Task<Category?> GetByIdAsync(int id)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Category>(
            "SELECT * FROM Categories WHERE Id = @Id", new { Id = id });
    }

    public async Task<int> CreateAsync(Category category)
    {
        using var conn = _context.CreateConnection();
        string sql = "INSERT INTO Categories (Name, Description) VALUES (@Name, @Description); SELECT last_insert_rowid();";
        int id = await conn.ExecuteScalarAsync<int>(sql, category);
        category.Id = id;
        return id;
    }
}

public class StoreProfileRepository : IStoreProfileRepository
{
    private readonly DatabaseContext _context;

    public StoreProfileRepository(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<StoreProfile> GetProfileAsync()
    {
        using var conn = _context.CreateConnection();
        var profile = await conn.QueryFirstOrDefaultAsync<StoreProfile>("SELECT * FROM StoreProfile WHERE Id = 1");
        return profile ?? new StoreProfile();
    }

    public async Task<bool> UpdateProfileAsync(StoreProfile profile)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            UPDATE StoreProfile SET
                StoreName = @StoreName,
                BranchName = @BranchName,
                Address = @Address,
                Phone = @Phone,
                ReceiptHeader = @ReceiptHeader,
                ReceiptFooter = @ReceiptFooter,
                TaxPercentage = @TaxPercentage,
                DefaultTaxInclusive = @DefaultTaxInclusive
            WHERE Id = 1";

        int rows = await conn.ExecuteAsync(sql, new {
            profile.StoreName,
            profile.BranchName,
            profile.Address,
            profile.Phone,
            profile.ReceiptHeader,
            profile.ReceiptFooter,
            profile.TaxPercentage,
            DefaultTaxInclusive = profile.DefaultTaxInclusive ? 1 : 0
        });

        return rows > 0;
    }
}

public class LicenseRepository : ILicenseRepository
{
    private readonly DatabaseContext _context;

    public LicenseRepository(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<LicenseInfo?> GetCurrentLicenseAsync()
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<LicenseInfo>("SELECT * FROM LicenseInfo WHERE Id = 1");
    }

    public async Task<bool> SaveLicenseAsync(LicenseInfo license)
    {
        using var conn = _context.CreateConnection();
        string sql = @"
            INSERT INTO LicenseInfo (
                Id, LicenseKey, ContractId, HardwareFingerprint, ClientName, OutletName,
                IssueDate, ExpiryDate, GracePeriodDays, Status, LastSyncDate, Signature, Features
            ) VALUES (
                1, @LicenseKey, @ContractId, @HardwareFingerprint, @ClientName, @OutletName,
                @IssueDate, @ExpiryDate, @GracePeriodDays, @Status, @LastSyncDate, @Signature, @Features
            )
            ON CONFLICT(Id) DO UPDATE SET
                LicenseKey = excluded.LicenseKey,
                ContractId = excluded.ContractId,
                HardwareFingerprint = excluded.HardwareFingerprint,
                ClientName = excluded.ClientName,
                OutletName = excluded.OutletName,
                IssueDate = excluded.IssueDate,
                ExpiryDate = excluded.ExpiryDate,
                GracePeriodDays = excluded.GracePeriodDays,
                Status = excluded.Status,
                LastSyncDate = excluded.LastSyncDate,
                Signature = excluded.Signature,
                Features = excluded.Features;";

        int rows = await conn.ExecuteAsync(sql, new {
            license.LicenseKey,
            license.ContractId,
            license.HardwareFingerprint,
            license.ClientName,
            license.OutletName,
            IssueDate = license.IssueDate.ToString("O"),
            ExpiryDate = license.ExpiryDate.ToString("O"),
            license.GracePeriodDays,
            Status = (int)license.Status,
            LastSyncDate = license.LastSyncDate?.ToString("O"),
            license.Signature,
            license.Features
        });

        return rows > 0;
    }
}
