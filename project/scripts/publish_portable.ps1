# ==============================================================================
# Spark POS - Build & Publish Portable Executable (.exe)
# Self-contained single-file desktop application with embedded SQLite & .NET runtime
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SPARK POS - STANDALONE PORTABLE BUILDER (.EXE)     " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
$csprojPath = Join-Path $projectRoot "src\POS.UI\POS.UI.csproj"
$outputDir = Join-Path $projectRoot "dist\portable"

Write-Host "[1/2] Membersihkan direktori output: $outputDir" -ForegroundColor Yellow
if (Test-Path $outputDir) {
    Remove-Item -Recurse -Force $outputDir
}

Write-Host "[2/2] Mempublikasikan single-file standalone executable win-x64..." -ForegroundColor Yellow
dotnet publish "$csprojPath" `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=none `
    -p:DebugSymbols=false `
    -o "$outputDir"

if ($LASTEXITCODE -eq 0) {
    $exePath = Join-Path $outputDir "SparkPOS.exe"
    # Clean any leftover debug symbol files, database files, and license files
    Get-ChildItem -Path $outputDir -Recurse -Include *.pdb,*.db,*.sqlite,*.db-wal,*.db-shm,*.key,*.lic -File | Remove-Item -Force -ErrorAction SilentlyContinue

        $sizeMB = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
        Write-Host "`nSUKSES! Aplikasi Portable Siap Digunakan!" -ForegroundColor Green
        Write-Host "Lokasi Executable: $exePath" -ForegroundColor White
        Write-Host "Ukuran File      : $sizeMB MB (Self-Contained Single File, Zero-Install, Zero-DB Fresh)" -ForegroundColor White
        Write-Host "Dapat dijalankan langsung di PC Windows tanpa perlu install .NET Runtime atau SQLite." -ForegroundColor Cyan
        Write-Host "Database akan otomatis diinisialisasi bersih (fresh database) saat dijalankan di PC baru." -ForegroundColor Green
} else {
    Write-Error "Gagal melakukan publish portable. Silakan cek pesan kesalahan di atas."
}
