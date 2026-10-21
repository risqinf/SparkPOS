# ==============================================================================
# Spark POS - Automated Database Backup & Restore Utility
# Safely backups the SQLite database without interrupting active transactions.
# ==============================================================================
param(
    [string]$TargetFolder,
    [string]$RestoreFile
)

$ErrorActionPreference = "Stop"

$appData = Path-Combine $env:LOCALAPPDATA "SparkPOS"
function Path-Combine($p1, $p2) { [System.IO.Path]::Combine($p1, $p2) }

$dbPath = Path-Combine $env:LOCALAPPDATA "SparkPOS\spark_pos.db"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   SPARK POS - PENCADANGAN DATABASE SQLITE LOKAL     " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

if ($RestoreFile) {
    if (-not (Test-Path $RestoreFile)) {
        Write-Error "File restore tidak ditemukan: $RestoreFile"
        exit 1
    }

    Write-Host "PERINGATAN: Memulihkan database dari: $RestoreFile" -ForegroundColor Yellow
    # Close running SparkPOS instances
    Get-Process -Name "SparkPOS" -ErrorAction SilentlyContinue | Stop-Process -Force

    # Create safety backup
    $safetyBackup = Path-Combine $env:LOCALAPPDATA "SparkPOS\spark_pos_pre_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
    if (Test-Path $dbPath) {
        Copy-Item -Path $dbPath -Destination $safetyBackup -Force
        Write-Host "Salinan pengaman dibuat: $safetyBackup" -ForegroundColor Gray
    }

    Copy-Item -Path $RestoreFile -Destination $dbPath -Force
    # Clean WAL & SHM
    if (Test-Path "$dbPath-wal") { Remove-Item "$dbPath-wal" -Force }
    if (Test-Path "$dbPath-shm") { Remove-Item "$dbPath-shm" -Force }

    Write-Host "SUKSES: Database berhasil dipulihkan dari $RestoreFile" -ForegroundColor Green
    exit 0
}

# Default Action: Export / Backup
if (-not (Test-Path $dbPath)) {
    Write-Host "Database belum dibuat di $dbPath (Aplikasi belum pernah dijalankan)." -ForegroundColor Yellow
    exit 0
}

if (-not $TargetFolder) {
    $myDocs = [Environment]::GetFolderPath('MyDocuments')
    $TargetFolder = Path-Combine $myDocs "SparkPOS_Backups"
}

if (-not (Test-Path $TargetFolder)) {
    New-Item -ItemType Directory -Path $TargetFolder -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupName = "SparkPOS_Backup_$timestamp.db"
$destination = Path-Combine $TargetFolder $backupName

Copy-Item -Path $dbPath -Destination $destination -Force

$sizeMB = [math]::Round((Get-Item $destination).Length / 1KB, 2)

Write-Host "SUKSES: Database berhasil dicadangkan!" -ForegroundColor Green
Write-Host "Lokasi File : $destination" -ForegroundColor White
Write-Host "Ukuran File : $sizeMB KB" -ForegroundColor White
Write-Host "Waktu       : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
