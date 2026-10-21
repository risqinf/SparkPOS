@echo off
title Spark POS - Build Portable (.exe)
echo =====================================================
echo   SPARK POS - STANDALONE PORTABLE BUILDER (.EXE)
echo =====================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish_portable.ps1"
pause
