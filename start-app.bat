@echo off
echo ================================
echo   Duplicate File Detector
echo   Windows Startup Helper
echo ================================
echo.
echo This is a legacy batch file.
echo For better experience, please use PowerShell scripts:
echo.
echo 1. Right-click powershell-start.ps1 and select "Run with PowerShell"
echo 2. Or open PowerShell and run: .\powershell-start.ps1
echo.
echo Attempting traditional startup method...
echo.
npm run electron:dev
echo.
echo Press any key to exit...
pause >nul