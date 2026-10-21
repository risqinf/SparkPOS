# ==============================================================================
# Spark POS - Windows Uninstaller Script
# Removes shortcuts, registry entries, and program files cleanly.
# ==============================================================================
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

$appName = "Spark POS"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\SparkPOS"
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Spark POS"
$desktopShortcut = Join-Path $env:USERPROFILE "Desktop\Spark POS.lnk"
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SparkPOS"

$confirm = [System.Windows.Forms.MessageBox]::Show(
    "Apakah Anda yakin ingin menghapus instalasi Spark POS dari komputer ini?",
    "Konfirmasi Hapus Instalasi Spark POS",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
)

if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) {
    exit 0
}

Write-Host "Menghapus Spark POS..." -ForegroundColor Yellow

# 1. Close any running process
Get-Process -Name "SparkPOS" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Remove Start Menu folder & shortcuts
if (Test-Path $startMenuDir) {
    Remove-Item -Recurse -Force $startMenuDir -ErrorAction SilentlyContinue
}

# 3. Remove Desktop shortcut
if (Test-Path $desktopShortcut) {
    Remove-Item -Force $desktopShortcut -ErrorAction SilentlyContinue
}

# 4. Remove Windows Registry Uninstall Entry
if (Test-Path $regPath) {
    Remove-Item -Recurse -Force $regPath -ErrorAction SilentlyContinue
}

# 5. Remove Program files (Schedule self-deletion of folder after batch exit)
$cmdScript = @"
@echo off
timeout /t 1 /nobreak >nul
rmdir /s /q "$installDir"
"@
$cleanerBat = Join-Path $env:TEMP "SparkPOS_Cleanup.bat"
Set-Content -Path $cleanerBat -Value $cmdScript
Start-Process "cmd.exe" -ArgumentList "/c `"$cleanerBat`"" -WindowStyle Hidden

[System.Windows.Forms.MessageBox]::Show(
    "Spark POS telah berhasil dihapus dari komputer Anda.",
    "Hapus Instalasi Selesai",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
)
