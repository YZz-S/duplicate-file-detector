# PowerShell Startup Script for Duplicate File Detector
# Fixed version that properly handles Vite and Electron startup
# 解决中文文件名乱码问题

# 设置控制台代码页为UTF-8 (65001)
try {
    chcp 65001 > $null
    Write-Host "[Encoding] Console code page set to UTF-8" -ForegroundColor Green
} catch {
    Write-Host "[Warning] Unable to set console code page" -ForegroundColor Yellow
}

# 设置控制台编码为UTF-8以支持中文字符
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 设置PowerShell会话的默认编码
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

# 设置环境变量以确保Node.js和Electron使用UTF-8编码
$env:NODE_OPTIONS = "--max-old-space-size=4096"
$env:ELECTRON_ENABLE_LOGGING = "1"
$env:LANG = "zh_CN.UTF-8"
$env:LC_ALL = "zh_CN.UTF-8"
$env:PYTHONIOENCODING = "utf-8"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Duplicate File Detector" -ForegroundColor Cyan  
Write-Host "   PowerShell Startup Script" -ForegroundColor Cyan
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

# Function to kill processes on port 5174
function Clear-Port5174 {
    try {
        $processes = netstat -ano | Select-String ":5174" | ForEach-Object {
            $fields = $_.ToString().Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
            if ($fields.Length -ge 5) { $fields[4] }
        }
        
        foreach ($pid in $processes) {
            if ($pid -and $pid -ne "0") {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "Killed process $pid on port 5174" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "Port cleanup completed" -ForegroundColor Yellow
    }
}

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js is available: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found!" -ForegroundColor Red
    Write-Host "Please install from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check project files
if (!(Test-Path "package.json")) {
    Write-Host "[ERROR] package.json not found!" -ForegroundColor Red
    Write-Host "Make sure you're in the correct directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Application (Manual Method)..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Build Electron main process
Write-Host "Step 1: Building Electron main process..." -ForegroundColor Cyan
try {
    & npm run electron:build-dev
    Write-Host "[OK] Electron main process built" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Build had issues, but continuing..." -ForegroundColor Yellow
}

# Step 2: Clear port 5174
Write-Host "Step 2: Clearing port 5174..." -ForegroundColor Cyan
Clear-Port5174

# Step 3: Start Vite server in background
Write-Host "Step 3: Starting Vite development server..." -ForegroundColor Cyan
$viteJob = Start-Job -ScriptBlock { 
    Set-Location $using:PWD
    & npm run dev
}

Write-Host "[OK] Vite server started in background (Job ID: $($viteJob.Id))" -ForegroundColor Green

# Step 4: Wait for Vite to be ready
Write-Host "Step 4: Waiting for Vite server to be ready..." -ForegroundColor Cyan
$maxAttempts = 30
$attempt = 0

do {
    $attempt++
    Write-Host "Attempt $attempt/$maxAttempts : Checking http://localhost:5174..." -ForegroundColor Yellow
    
    if (Test-WebService "http://localhost:5174") {
        Write-Host "[OK] Vite server is ready!" -ForegroundColor Green
        break
    }
    
    if ($attempt -ge $maxAttempts) {
        Write-Host "[ERROR] Vite server failed to start after $maxAttempts attempts" -ForegroundColor Red
        Write-Host "Vite job output:" -ForegroundColor Yellow
        Receive-Job $viteJob -Keep
        Read-Host "Press Enter to exit"
        Stop-Job $viteJob -ErrorAction SilentlyContinue
        Remove-Job $viteJob -ErrorAction SilentlyContinue
        exit 1
    }
    
    Start-Sleep -Seconds 2
} while ($true)

# Step 5: Start Electron
Write-Host "Step 5: Starting Electron application..." -ForegroundColor Cyan
try {
    & npx electron .
    Write-Host "[OK] Electron application closed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to start Electron" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Cleanup
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cleaning up..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Stop Vite job
try {
    Stop-Job $viteJob -ErrorAction SilentlyContinue
    Remove-Job $viteJob -ErrorAction SilentlyContinue
    Write-Host "[OK] Vite job stopped" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Could not stop Vite job cleanly" -ForegroundColor Yellow
}

# Final cleanup
Clear-Port5174

Write-Host ""
Write-Host "Script completed. Press Enter to exit..." -ForegroundColor Green
Read-Host