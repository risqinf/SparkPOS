# ==============================================================================
# Spark POS - Windows Installer Script
# Installs Spark POS, creates Start Menu & Desktop shortcuts, and sets up Uninstaller.
# ==============================================================================
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$appName = "Spark POS"
$appVersion = "1.0.0"
$publisher = "SparkPOS Retail"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\SparkPOS"
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Spark POS"
$desktopShortcut = Join-Path $env:USERPROFILE "Desktop\Spark POS.lnk"

# Determine source directory (where SparkPOS.exe is located)
$scriptDir = $PSScriptRoot
$sourceExe = Join-Path $scriptDir "..\dist\portable\SparkPOS.exe"
if (-not (Test-Path $sourceExe)) {
    $sourceExe = Join-Path $scriptDir "SparkPOS.exe"
}

if (-not (Test-Path $sourceExe)) {
    [System.Windows.Forms.MessageBox]::Show(
        "File 'SparkPOS.exe' tidak ditemukan! Pastikan Anda telah menjalankan build portable terlebih dahulu.",
        "Error Instalasi Spark POS",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
    exit 1
}

Write-Host "Menginstal Spark POS ke: $installDir" -ForegroundColor Cyan

# 1. Close any running instance
Get-Process -Name "SparkPOS" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Create Destination Directory
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# 3. Copy Application Files
Copy-Item -Path $sourceExe -Destination (Join-Path $installDir "SparkPOS.exe") -Force

# Copy uninstaller scripts into installation directory
$uninstallerPs1 = Join-Path $scriptDir "Uninstall_SparkPOS.ps1"
$uninstallerBat = Join-Path $scriptDir "Uninstall_SparkPOS.bat"

if (Test-Path $uninstallerPs1) {
    Copy-Item -Path $uninstallerPs1 -Destination (Join-Path $installDir "Uninstall_SparkPOS.ps1") -Force
}
if (Test-Path $uninstallerBat) {
    Copy-Item -Path $uninstallerBat -Destination (Join-Path $installDir "Uninstall_SparkPOS.bat") -Force
}

# 4. Create Start Menu Shortcuts Folder
if (-not (Test-Path $startMenuDir)) {
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
}

$wshShell = New-Object -ComObject WScript.Shell

# 4a. Main App Shortcut in Start Menu
$appShortcutPath = Join-Path $startMenuDir "Spark POS.lnk"
$appShortcut = $wshShell.CreateShortcut($appShortcutPath)
$appShortcut.TargetPath = Join-Path $installDir "SparkPOS.exe"
$appShortcut.WorkingDirectory = $installDir
$appShortcut.Description = "Spark POS - Sistem Kasir Desktop Retail Offline"
$appShortcut.Save()

# 4b. Dedicated Uninstall Shortcut in Start Menu (Permintaan User)
$uninstallShortcutPath = Join-Path $startMenuDir "Uninstall Spark POS.lnk"
$uninstallShortcut = $wshShell.CreateShortcut($uninstallShortcutPath)
$uninstallShortcut.TargetPath = Join-Path $installDir "Uninstall_SparkPOS.bat"
$uninstallShortcut.WorkingDirectory = $installDir
$uninstallShortcut.Description = "Hapus Instalasi Spark POS dari Komputer"
$uninstallShortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,31" # Windows Uninstall Trash/Cancel icon
$uninstallShortcut.Save()

# 5. Desktop Shortcut
$desktopShortcutObj = $wshShell.CreateShortcut($desktopShortcut)
$desktopShortcutObj.TargetPath = Join-Path $installDir "SparkPOS.exe"
$desktopShortcutObj.WorkingDirectory = $installDir
$desktopShortcutObj.Description = "Spark POS - Sistem Kasir Desktop"
$desktopShortcutObj.Save()

# 6. Register in Windows Settings / Add Remove Programs (Registry)
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SparkPOS"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}

Set-ItemProperty -Path $regPath -Name "DisplayName" -Value $appName
Set-ItemProperty -Path $regPath -Name "DisplayVersion" -Value $appVersion
Set-ItemProperty -Path $regPath -Name "Publisher" -Value $publisher
Set-ItemProperty -Path $regPath -Name "InstallLocation" -Value $installDir
Set-ItemProperty -Path $regPath -Name "DisplayIcon" -Value (Join-Path $installDir "SparkPOS.exe")
Set-ItemProperty -Path $regPath -Name "UninstallString" -Value "`"$installDir\Uninstall_SparkPOS.bat`""
Set-ItemProperty -Path $regPath -Name "NoModify" -Value 1 -Type DWord
Set-ItemProperty -Path $regPath -Name "NoRepair" -Value 1 -Type DWord

Write-Host "Instalasi Spark POS berhasil!" -ForegroundColor Green

# 7. Success Dialog with Launch Option
$msgResult = [System.Windows.Forms.MessageBox]::Show(
    "Instalasi Spark POS berhasil diselesaikan!`n`n" +
    "- Shortcut telah dibuat di Menu Start: 'Spark POS'`n" +
    "- Opsi Hapus Instalasi telah dibuat di Menu Start: 'Uninstall Spark POS'`n" +
    "- Shortcut Desktop telah dibuat.`n`n" +
    "Apakah Anda ingin menjalankan Spark POS sekarang?",
    "Instalasi Spark POS Selesai",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Information
)

if ($msgResult -eq [System.Windows.Forms.DialogResult]::Yes) {
    Start-Process (Join-Path $installDir "SparkPOS.exe")
}
