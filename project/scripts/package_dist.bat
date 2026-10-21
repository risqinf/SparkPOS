@echo off
title Spark POS - Build All Distribution Packages
echo ========================================================
echo     SPARK POS - DISTRIBUSI LENGKAP (PORTABLE + SETUP)
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0package_dist.ps1"
pause
