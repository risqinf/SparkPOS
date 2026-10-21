using System;
using System.Windows.Forms;
using Microsoft.Extensions.DependencyInjection;
using POS.Application;
using POS.Domain;
using POS.Infrastructure;
using POS.Infrastructure.Repositories;
using POS.License;
using POS.UI.Forms;

namespace POS.UI;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        // 1. Setup DI Services
        var services = new ServiceCollection();

        // Infrastructure & Database
        services.AddSingleton<DatabaseContext>();
        services.AddSingleton<DatabaseBackupService>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<IShiftRepository, ShiftRepository>();
        services.AddScoped<IEmployeeRepository, EmployeeRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IStoreProfileRepository, StoreProfileRepository>();
        services.AddScoped<ILicenseRepository, LicenseRepository>();

        // License & Security
        services.AddSingleton<LicenseManager>();

        // Application Services
        services.AddSingleton<AuthService>();
        services.AddSingleton<ShiftService>();
        services.AddSingleton<SalesService>();
        services.AddSingleton<ReportService>();

        // UI Forms
        services.AddTransient<FormMain>();

        var provider = services.BuildServiceProvider();

        // 2. Run Database Migrations & Initial Seed Data
        try
        {
            var db = provider.GetRequiredService<DatabaseContext>();
            DatabaseMigrator.MigrateAsync(db).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Gagal inisialisasi database SQLite: {ex.Message}", "Database Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        // 3. Run Main Form
        var mainForm = provider.GetRequiredService<FormMain>();
        System.Windows.Forms.Application.Run(mainForm);
    }
}