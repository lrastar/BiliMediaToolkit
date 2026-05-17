@echo off
title BiliMediaToolkit
chcp 65001 >nul
echo [INFO] Starting BiliMediaToolkit...
cd server
echo [INFO] Installing dependencies...
if not exist "node_modules" (npm install --no-audit --no-fund)
echo [INFO] Starting server...
node index.js
pause
