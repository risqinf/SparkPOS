# ==============================================================================
# Spark POS - Full Distribution Packager
# Produces:
# 1. Portable Standalone .exe (Zero-Install, Zero-DB)
# 2. Setup Installer with Start Menu "Uninstall Spark POS" integration (Zero-DB)
# 3. Developer License Keygen Standalone App (For Owner Only)
# ==============================================================================
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$portableDir = Join-Path $projectRoot "dist\portable"
$installerDir = Join-Path $projectRoot "dist\installer"
$installerSource = Join-Path $projectRoot "installer"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "       SPARK POS - DISTRIBUSI LENGKAP APLIKASI       " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Build Portable Executable
& (Join-Path $PSScriptRoot "publish_portable.ps1")

if (-not (Test-Path (Join-Path $portableDir "SparkPOS.exe"))) {
    Write-Error "Gagal menemukan SparkPOS.exe di $portableDir"
    exit 1
}

# 2. Prepare Installer Distribution Folder
if (-not (Test-Path $installerDir)) {
    New-Item -ItemType Directory -Path $installerDir -Force | Out-Null
}

$setupFolder = Join-Path $installerDir "SparkPOS_Setup_Package"
if (Test-Path $setupFolder) {
    Remove-Item -Recurse -Force $setupFolder
}
New-Item -ItemType Directory -Path $setupFolder -Force | Out-Null

Copy-Item (Join-Path $portableDir "SparkPOS.exe") -Destination (Join-Path $setupFolder "SparkPOS.exe") -Force
Copy-Item (Join-Path $installerSource "Install_SparkPOS.bat") -Destination (Join-Path $setupFolder "Install_SparkPOS.bat") -Force
Copy-Item (Join-Path $installerSource "Install_SparkPOS.ps1") -Destination (Join-Path $setupFolder "Install_SparkPOS.ps1") -Force
Copy-Item (Join-Path $installerSource "Uninstall_SparkPOS.bat") -Destination (Join-Path $setupFolder "Uninstall_SparkPOS.bat") -Force
Copy-Item (Join-Path $installerSource "Uninstall_SparkPOS.ps1") -Destination (Join-Path $setupFolder "Uninstall_SparkPOS.ps1") -Force

# Jaminan Kebersihan Total (Zero-DB, Zero-PDB, Zero-License in client distributions)
Write-Host "`n[Verifikasi] Memastikan tidak ada file database, file lisensi, atau file debug di folder rilis..." -ForegroundColor Cyan
$leftoverFiles = Get-ChildItem -Path (Join-Path $projectRoot "dist") -Recurse -Include *.db,*.sqlite,*.db-wal,*.db-shm,*.key,*.lic,*.pdb,*.log -File
if ($leftoverFiles.Count -gt 0) {
    Write-Host "Menghapus $($leftoverFiles.Count) file non-distribusi dari paket rilis..." -ForegroundColor Yellow
    $leftoverFiles | Remove-Item -Force
}
Write-Host "[OK] Terverifikasi: Seluruh paket Portable dan Installer 100% bersih tanpa database dan tanpa file debug." -ForegroundColor Green

# Create README instruction in Setup Package
$readme = @(
    "SPARK POS - PANDUAN INSTALASI DAN DISTRIBUSI",
    "==========================================",
    "",
    "FORMAT 1: PORTABLE .EXE (Zero-Install)",
    "- Lokasi: dist\portable\SparkPOS.exe",
    "- Cara pakai: Langsung double-click SparkPOS.exe.",
    "- Database: Otomatis diinisialisasi baru (fresh) di %LOCALAPPDATA%\SparkPOS\spark_pos.db.",
    "- Kredensial Default:",
    "  * Administrator: Login = Administrator  |  Password = 123456",
    "  * Kasir        : Login = kasir1         |  Password = 1111",
    "",
    "FORMAT 2: INSTALLER SETUP (Dengan Opsi Uninstall di Start Menu)",
    "- Lokasi: dist\installer\SparkPOS_Setup_Package",
    "- Cara instal: Double-click 'Install_SparkPOS.bat'.",
    "- Otomatis membuat:",
    "  1. Menu Start -> Spark POS -> 'Spark POS' (Aplikasi)",
    "  2. Menu Start -> Spark POS -> 'Uninstall Spark POS' (Hapus Instalasi)",
    "  3. Shortcut di Desktop",
    "  4. Terdaftar di Windows Settings / Control Panel Programs and Features."
)
Set-Content -Path (Join-Path $setupFolder "PANDUAN_INSTALASI.txt") -Value $readme

# 3. Publish Developer Standalone Keygen (Khusus Pemilik)
Write-Host "`n[Keygen] Mempublikasikan SparkPOS.Keygen (Khusus Developer)..." -ForegroundColor Cyan
$keygenCsproj = Join-Path $projectRoot "tools\SparkPOS.Keygen\SparkPOS.Keygen.csproj"
$keygenDistDir = Join-Path $projectRoot "dist\tools\SparkPOS.Keygen"
if (Test-Path $keygenDistDir) { Remove-Item -Recurse -Force $keygenDistDir }

dotnet publish "$keygenCsproj" `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -o "$keygenDistDir" | Out-Null

$keygenZip = Join-Path $projectRoot "dist\SparkPOS_Keygen_DeveloperOnly.zip"
if (Test-Path $keygenZip) { Remove-Item $keygenZip -Force }
if (Test-Path (Join-Path $keygenDistDir "SparkPOS.Keygen.exe")) {
    Compress-Archive -Path "$keygenDistDir\SparkPOS.Keygen.exe" -DestinationPath $keygenZip -Force
    Write-Host "[OK] SparkPOS.Keygen siap di: $keygenDistDir\SparkPOS.Keygen.exe" -ForegroundColor Green
}

# 4. Try Inno Setup Compiler if installed
$isccCmd = Get-Command "iscc.exe" -ErrorAction SilentlyContinue
$isccSource = if ($isccCmd) { $isccCmd.Source } else { $null }
$isccPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\iscc.exe",
    "C:\Program Files\Inno Setup 6\iscc.exe",
    $isccSource
) | Where-Object { $_ -and (Test-Path $_) }

if ($isccPaths.Count -gt 0) {
    $iscc = $isccPaths[0]
    Write-Host "`nDitemukan Inno Setup Compiler di: $iscc" -ForegroundColor Green
    Write-Host "Mengompilasi SparkPOS_Setup_v1.0.0.exe installer..." -ForegroundColor Yellow
    $issFile = Join-Path $installerSource "SparkPOS_Setup.iss"
    & "$iscc" "$issFile"
} else {
    Write-Host "`nInfo: Inno Setup (ISCC) belum terpasang di sistem. Paket instalasi 1-klik siap digunakan di folder 'SparkPOS_Setup_Package'." -ForegroundColor Yellow
}

# 5. Create ZIP Archives for Easy Sharing
Write-Host "`nMembuat arsip ZIP untuk dibagikan..." -ForegroundColor Cyan
$portableZip = Join-Path $projectRoot "dist\SparkPOS_Portable_v1.0.0.zip"
$installerZip = Join-Path $projectRoot "dist\SparkPOS_Setup_v1.0.0.zip"

if (Test-Path $portableZip) { Remove-Item $portableZip -Force }
if (Test-Path $installerZip) { Remove-Item $installerZip -Force }

Compress-Archive -Path (Join-Path $portableDir "SparkPOS.exe") -DestinationPath $portableZip -Force
Compress-Archive -Path "$setupFolder\*" -DestinationPath $installerZip -Force

Write-Host "=====================================================" -ForegroundColor Green
Write-Host "               SELESAI DENGAN SUKSES!                " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "1. Portable Standalone (Zero-DB Fresh) :" -ForegroundColor White
Write-Host "   - $portableDir\SparkPOS.exe" -ForegroundColor White
Write-Host "   - Arsip ZIP: $portableZip" -ForegroundColor White
Write-Host "2. Installer Package (Zero-DB Fresh, Opsi Uninstall di Start) :" -ForegroundColor White
Write-Host "   - Folder Setup: $setupFolder" -ForegroundColor White
Write-Host "   - Arsip ZIP: $installerZip" -ForegroundColor White
Write-Host "3. Developer Keygen (Khusus Pemilik - Generator Lisensi Offline) :" -ForegroundColor White
Write-Host "   - $keygenDistDir\SparkPOS.Keygen.exe" -ForegroundColor White
Write-Host "   - Arsip ZIP: $keygenZip" -ForegroundColor White
