# Second PowerShell script - Start Electron only
# Use this after Vite server is already running

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Duplicate File Detector" -ForegroundColor Cyan  
Write-Host "   Electron Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if URL is responding
function Test-WebService {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Check if Vite server is running
Write-Host "Checking if Vite server is running..." -ForegroundColor Yellow
if (Test-WebService "http://localhost:5174") {
    Write-Host "[OK] Vite server is running at http://localhost:5174" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Vite server is not running!" -ForegroundColor Red
    Write-Host "Please run the main script first or manually start:" -ForegroundColor Yellow
    Write-Host "  npm run dev" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Electron main process is built
Write-Host "Checking Electron main process..." -ForegroundColor Yellow
if (Test-Path "dist-electron/main.cjs") {
    Write-Host "[OK] Electron main process found" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Electron main process not found, building..." -ForegroundColor Yellow
    try {
        & npm run electron:build-dev
        Write-Host "[OK] Electron main process built" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to build Electron main process" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Start Electron
Write-Host ""
Write-Host "Starting Electron application..." -ForegroundColor Cyan
Write-Host "The Electron window should appear shortly..." -ForegroundColor Yellow
Write-Host ""

try {
    & npx electron .
    Write-Host ""
    Write-Host "[OK] Electron application closed normally" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "[ERROR] Failed to start Electron" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "Script completed. Press Enter to exit..." -ForegroundColor Green
Read-Host