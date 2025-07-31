#!/bin/bash

# Set UTF-8 encoding
export LC_ALL=en_US.UTF-8 2>/dev/null || export LC_ALL=C.UTF-8 2>/dev/null || true

echo "==============================="
echo "  Duplicate File Detector"
echo "    Unix/Linux Startup Script"
echo "==============================="
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found, please install Node.js first"
    echo "Download from: https://nodejs.org/"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not available"
    exit 1
fi

echo "[INFO] Starting application..."
echo

# Run the startup script
npm run start:safe

if [ $? -ne 0 ]; then
    echo
    echo "[ERROR] Application failed to start! Please check the error messages above."
    echo
    echo "Common solutions:"
    echo "1. Run: npm install"
    echo "2. Check if port 5174 is occupied"
    echo "3. Check Node.js version (should be 16+)"
    echo "4. Run: npm run health-check"
    echo
    exit 1
fi

echo
echo "[INFO] Application has been closed."