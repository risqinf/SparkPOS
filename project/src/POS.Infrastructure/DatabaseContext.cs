using System;
using System.IO;
using Microsoft.Data.Sqlite;

namespace POS.Infrastructure;

public class DatabaseContext
{
    private readonly string _connectionString;
    public string DatabasePath { get; }

    public DatabaseContext(string? dbPath = null)
    {
        if (string.IsNullOrEmpty(dbPath))
        {
            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SparkPOS");
            Directory.CreateDirectory(appData);
            DatabasePath = Path.Combine(appData, "spark_pos.db");
        }
        else
        {
            DatabasePath = dbPath;
            var dir = Path.GetDirectoryName(dbPath);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
        }

        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = DatabasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        };

        _connectionString = builder.ConnectionString;
    }

    public SqliteConnection CreateConnection()
    {
        var conn = new SqliteConnection(_connectionString);
        conn.Open();
        return conn;
    }
}
