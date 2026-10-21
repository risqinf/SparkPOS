@echo off
title Spark POS - Uji Coba Mode Fresh (Simulasi PC Baru)
echo ========================================================
echo   SIMULASI SPARK POS DI PC BARU (ISOLASI SEMENTARA)
echo ========================================================
echo.
echo Script ini akan menjalankan SparkPOS.exe dalam lingkungan
echo terisolasi (Sandbox Temp) tanpa menyentuh data asli Anda.
echo.
echo Anda akan melihat:
echo 1. Lisensi: 'Belum Terdaftar' (Fresh)
echo 2. Database: Bersih (0 transaksi)
echo 3. Login: Administrator (Password: 123456)
echo.
echo Menyiapkan folder pengujian sementara...

set "SANDBOX_DIR=%TEMP%\SparkPOS_FreshSimulation"
if exist "%SANDBOX_DIR%" rmdir /s /q "%SANDBOX_DIR%"
mkdir "%SANDBOX_DIR%"

set "LOCALAPPDATA=%SANDBOX_DIR%"

echo Menjalankan SparkPOS.exe dari paket Portable...
if exist "dist\portable\SparkPOS.exe" (
    start "" "dist\portable\SparkPOS.exe"
) else if exist "..\dist\portable\SparkPOS.exe" (
    start "" "..\dist\portable\SparkPOS.exe"
) else (
    echo [ERROR] dist\portable\SparkPOS.exe tidak ditemukan.
    pause
    exit /b 1
)

echo.
echo Aplikasi berjalan dalam mode Fresh! Silakan cek menu Lisensi dan Kasir.
echo.
pause
