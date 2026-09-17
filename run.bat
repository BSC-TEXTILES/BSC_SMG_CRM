@echo off
setlocal enabledelayedexpansion
title BSC Enterprise HRMS - Local Launcher

echo ===============================================================================
echo            BSC ENTERPRISE HRMS ^& CRM - LOCAL SYSTEM LAUNCHER
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Check and start MySQL service if stopped
echo [1/4] Checking MySQL Database Service...
sc query "MySQL80" 2>nul | find /i "RUNNING" >nul
if %errorlevel% neq 0 (
    echo [INFO] MySQL80 service is not running. Attempting to start...
    net start MySQL80 >nul 2>&1
    if %errorlevel% neq 0 (
        net start MySQL >nul 2>&1
    )
)

:: 2. Verify and initialize database if needed
echo [2/4] Verifying and connecting to local database...
node backend/src/scripts/init_local_db.js
if %errorlevel% neq 0 (
    echo [ERROR] Could not connect to local MySQL database.
    echo Please make sure your MySQL service is running on port 3306.
    pause
    exit /b 1
)

:: 3. Inform user of access URLs
echo.
echo [3/4] Preparing to launch application...
echo -------------------------------------------------------------------------------
echo   Frontend Web App : http://localhost:3000
echo   Backend API      : http://localhost:5000
echo   Default Admin    : admin@bsctextiles.com / admin@2026
echo -------------------------------------------------------------------------------
echo.

:: 4. Automatically open the default browser after 3 seconds
echo [4/4] Opening browser at http://localhost:3000 ...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: Start Frontend and Backend servers concurrently
npm run dev
