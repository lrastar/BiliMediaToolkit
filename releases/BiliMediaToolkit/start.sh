#!/bin/bash
echo "[INFO] Starting BiliMediaToolkit..."
cd server
echo "[INFO] Installing dependencies..."
if [ ! -d "node_modules" ]; then npm install --no-audit --no-fund; fi
echo "[INFO] Starting server..."
node index.js
