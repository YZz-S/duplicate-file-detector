# -*- coding: utf-8 -*-
# PowerShell script for building and packaging the application for release
# This script provides enhanced functionality compared to 'npm run electron:pack'
# including cleaning, health checks, and multi-platform support
param(
    [switch]$Help,
    [switch]$Clean,
    [string]$Platform = "current"
)

# Ensure UTF-8 encoding support
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ($Help) {
    Write-Host "Usage: .\build-release.ps1 [options]"
    Write-Host ""
    Write-Host "This script provides enhanced build functionality compared to 'npm run electron:pack':"
    Write-Host "- Automatic dependency installation"
    Write-Host "- Health checks before building"
    Write-Host "- Directory cleaning options"
    Write-Host "- Multi-platform build support"
    Write-Host "- Detailed build progress and file listing"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Help        Show this help message"
    Write-Host "  -Clean       Clean dist and release directories before building"
    Write-Host "  -Platform    Target platform: 'current', 'all', 'win', 'mac', 'linux'"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\build-release.ps1                    # Build for current platform"
    Write-Host "  .\build-release.ps1 -Clean             # Clean and build"
    Write-Host "  .\build-release.ps1 -Platform all      # Build for all platforms"
    Write-Host ""
    Write-Host "For simple builds, you can also use: npm run electron:pack"
    exit 0
}

Write-Host "Starting build process for Duplicate File Detector..." -ForegroundColor Cyan

# Clean directories if requested
if ($Clean) {
    Write-Host "Cleaning build directories..." -ForegroundColor Yellow
    if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
    if (Test-Path "dist-electron") { Remove-Item "dist-electron" -Recurse -Force }
    if (Test-Path "release") { Remove-Item "release" -Recurse -Force }
    if (Test-Path "release-new") { Remove-Item "release-new" -Recurse -Force }
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Run health check
Write-Host "Running health check..." -ForegroundColor Yellow
npm run health-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "Health check failed, but continuing..." -ForegroundColor Yellow
}

# Build the application
Write-Host "Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
}

# Build Electron
Write-Host "Building Electron components..." -ForegroundColor Yellow
npm run electron:build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Electron build failed" -ForegroundColor Red
    exit 1
}

# Package the application
Write-Host "Packaging application for release..." -ForegroundColor Yellow

switch ($Platform.ToLower()) {
    "all" {
        Write-Host "Building for all platforms..." -ForegroundColor Cyan
        npm run electron:build
        npx electron-builder --publish=never --win --mac --linux
    }
    "win" {
        Write-Host "Building for Windows..." -ForegroundColor Cyan
        npm run electron:build
        npx electron-builder --publish=never --win
    }
    "mac" {
        Write-Host "Building for macOS..." -ForegroundColor Cyan
        npm run electron:build
        npx electron-builder --publish=never --mac
    }
    "linux" {
        Write-Host "Building for Linux..." -ForegroundColor Cyan
        npm run electron:build
        npx electron-builder --publish=never --linux
    }
    default {
        Write-Host "Building for current platform (equivalent to 'npm run electron:pack')..." -ForegroundColor Cyan
        npm run electron:pack
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host " Packaging failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "Release files are available in the 'release' directory" -ForegroundColor Green

# List generated files with full paths
$releaseDir = if (Test-Path "release-new") { "release-new" } elseif (Test-Path "release") { "release" } else { $null }

if ($releaseDir) {
    Write-Host ""
    Write-Host "Generated files with full paths:" -ForegroundColor Cyan
    Get-ChildItem $releaseDir -File | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        $fullPath = $_.FullName
        Write-Host "  $fullPath ($size MB)" -ForegroundColor White
    }
} else {
    Write-Host "No release directory found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Ready for GitHub release!" -ForegroundColor Green