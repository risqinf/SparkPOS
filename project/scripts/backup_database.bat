@echo off
title Spark POS - Pencadangan Database
echo ========================================================
echo        SPARK POS - PENCADANGAN DATABASE OTOMATIS
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup_database.ps1"
pause
