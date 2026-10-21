@echo off
title Spark POS - Bersihkan Data Pengujian Lokal
echo ========================================================
echo     BERSIHKAN DATA PENGUJIAN SPARK POS DI PC ANDA
echo ========================================================
echo.
echo PERINGATAN:
echo Tindakan ini akan menghapus file database dan lisensi
echo pengujian yang tersimpan di:
echo %LOCALAPPDATA%\SparkPOS
echo.
echo Setelah dihapus, PC Anda sendiri akan menjadi 100%% FRESH
echo seperti pertama kali aplikasi baru dipasang.
echo.
set /p CONFIRM="Ketik Y untuk melanjutkan pembersihan (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Dibatalkan.
    pause
    exit /b 0
)

echo.
echo Menghentikan proses SparkPOS yang sedang berjalan...
taskkill /f /im SparkPOS.exe >nul 2>&1

echo Menghapus folder data lokal: %LOCALAPPDATA%\SparkPOS
if exist "%LOCALAPPDATA%\SparkPOS" (
    rmdir /s /q "%LOCALAPPDATA%\SparkPOS"
    echo [SUKSES] Seluruh database dan lisensi lokal telah dibersihkan!
) else (
    echo [INFO] Folder data lokal sudah bersih.
)

echo.
echo Sekarang jika Anda menjalankan SparkPOS.exe, aplikasi akan
echo membuat database baru yang fresh dan lisensi kosong (unlicensed).
echo.
pause
