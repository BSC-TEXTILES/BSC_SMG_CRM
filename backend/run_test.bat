@echo off
cd /d D:\BTPL_SMG\BSC_SMG\backend
start /b node index.js > server.log 2>&1
timeout /t 5 /nobreak >nul
node test_api_login.js