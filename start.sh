#!/bin/bash
echo "[SHIELD] Activating Neural Bridge..."
echo "[SHIELD] Synchronizing Neural Core Dependencies..."
npm install
echo "[SHIELD] Establishing Secure Session..."
export GEMINI_API_KEY="YOUR_API_KEY_HERE"
npm run dev
