using System;
using System.IO;
using System.Threading.Tasks;
using POS.Infrastructure;
using Xunit;

namespace POS.Tests;

public class DatabaseBackupTests : IDisposable
{
    private readonly string _testDir;
    private readonly string _testDbPath;
    private readonly DatabaseContext _dbContext;
    private readonly DatabaseBackupService _backupService;

    public DatabaseBackupTests()
    {
        _testDir = Path.Combine(Path.GetTempPath(), "SparkPOS_Backup_Tests_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_testDir);
        _testDbPath = Path.Combine(_testDir, "test_spark.db");

        _dbContext = new DatabaseContext(_testDbPath);
        DatabaseMigrator.MigrateAsync(_dbContext).GetAwaiter().GetResult();
        _backupService = new DatabaseBackupService(_dbContext);
    }

    [Fact]
    public async Task ExportBackup_CreatesValidBackupFile()
    {
        string backupFile = Path.Combine(_testDir, "exported_backup.db");

        long bytes = await _backupService.ExportBackupAsync(backupFile);

        Assert.True(File.Exists(backupFile));
        Assert.True(bytes > 0);
        Assert.Equal(new FileInfo(backupFile).Length, bytes);
    }

    [Fact]
    public async Task ImportBackup_RestoresDatabaseSuccessfully()
    {
        string backupFile = Path.Combine(_testDir, "restore_test.db");
        await _backupService.ExportBackupAsync(backupFile);

        // Perform import
        await _backupService.ImportBackupAsync(backupFile);

        // Verify active database still works
        using var conn = _dbContext.CreateConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM Categories;";
        var count = Convert.ToInt32(cmd.ExecuteScalar());
        Assert.True(count > 0);
    }

    [Fact]
    public async Task ImportBackup_WithCorruptedFile_ThrowsInvalidOperationException()
    {
        string corruptedFile = Path.Combine(_testDir, "corrupted.db");
        File.WriteAllText(corruptedFile, "This is not a sqlite database file at all!");

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await _backupService.ImportBackupAsync(corruptedFile);
        });
    }

    public void Dispose()
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        try
        {
            if (Directory.Exists(_testDir))
            {
                Directory.Delete(_testDir, true);
            }
        }
        catch { }
    }
}
