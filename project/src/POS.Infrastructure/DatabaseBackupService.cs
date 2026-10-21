using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;

namespace POS.Infrastructure;

public class DatabaseBackupService
{
    private readonly DatabaseContext _dbContext;

    public DatabaseBackupService(DatabaseContext dbContext)
    {
        _dbContext = dbContext;
    }

    public string GetDatabasePath() => _dbContext.DatabasePath;

    public long GetDatabaseSizeBytes()
    {
        try
        {
            long size = 0;
            if (File.Exists(_dbContext.DatabasePath))
                size += new FileInfo(_dbContext.DatabasePath).Length;

            string wal = _dbContext.DatabasePath + "-wal";
            if (File.Exists(wal))
                size += new FileInfo(wal).Length;

            return size;
        }
        catch
        {
            return 0;
        }
    }

    public string GetDatabaseSizeFormatted()
    {
        long bytes = GetDatabaseSizeBytes();
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{bytes / 1024.0:F1} KB";
        return $"{bytes / (1024.0 * 1024.0):F2} MB";
    }

    public string GetDefaultBackupDirectory()
    {
        string docDir = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        string backupFolder = Path.Combine(docDir, "SparkPOS_Backups");
        if (!Directory.Exists(backupFolder))
        {
            Directory.CreateDirectory(backupFolder);
        }
        return backupFolder;
    }

    public string GenerateDefaultBackupFileName()
    {
        return $"SparkPOS_Backup_{DateTime.Now:yyyyMMdd_HHmmss}.db";
    }

    public string GenerateDefaultBackupFilePath()
    {
        return Path.Combine(GetDefaultBackupDirectory(), GenerateDefaultBackupFileName());
    }

    public async Task<long> ExportBackupAsync(string destinationFilePath)
    {
        return await Task.Run(() =>
        {
            var dir = Path.GetDirectoryName(destinationFilePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            // 1. Force WAL Checkpoint so all active transactions are committed to the main db file
            using (var source = _dbContext.CreateConnection())
            {
                using (var cmd = source.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
                    cmd.ExecuteNonQuery();
                }

                // 2. Use SQLite Online Backup API for 100% ACID consistency without blocking read operations
                using var destConn = new SqliteConnection($"Data Source={destinationFilePath}");
                destConn.Open();
                source.BackupDatabase(destConn);
            }

            return new FileInfo(destinationFilePath).Length;
        });
    }

    public async Task ImportBackupAsync(string sourceFilePath)
    {
        await Task.Run(() =>
        {
            if (!File.Exists(sourceFilePath))
                throw new FileNotFoundException("File database sumber tidak ditemukan.", sourceFilePath);

            // 1. Verify SQLite integrity of the imported file
            try
            {
                using var testConn = new SqliteConnection($"Data Source={sourceFilePath};Mode=ReadOnly");
                testConn.Open();
                using var cmd = testConn.CreateCommand();
                cmd.CommandText = "PRAGMA integrity_check;";
                var res = cmd.ExecuteScalar()?.ToString();
                if (res != "ok")
                {
                    throw new InvalidOperationException($"File database tidak valid atau terkorupsi (Hasil: {res}).");
                }
            }
            catch (SqliteException ex)
            {
                throw new InvalidOperationException($"File bukan database SQLite yang valid: {ex.Message}", ex);
            }

            // 2. Checkpoint and flush active database
            try
            {
                using var activeConn = _dbContext.CreateConnection();
                using var cmd = activeConn.CreateCommand();
                cmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
                cmd.ExecuteNonQuery();
            }
            catch { }

            // 3. Close and release all active connection pools
            SqliteConnection.ClearAllPools();

            // 4. Create an automatic safety rollback copy before overwriting
            string dbPath = _dbContext.DatabasePath;
            string dbDir = Path.GetDirectoryName(dbPath)!;
            string safetyBackup = Path.Combine(dbDir, $"spark_pos_pre_restore_{DateTime.Now:yyyyMMdd_HHmmss}.db");
            if (File.Exists(dbPath))
            {
                File.Copy(dbPath, safetyBackup, true);
            }

            // 5. Overwrite active database file with imported backup
            File.Copy(sourceFilePath, dbPath, true);

            // 6. Delete old WAL and SHM files to ensure no desynchronized log replay
            string wal = dbPath + "-wal";
            string shm = dbPath + "-shm";
            if (File.Exists(wal)) File.Delete(wal);
            if (File.Exists(shm)) File.Delete(shm);
        });
    }
}
