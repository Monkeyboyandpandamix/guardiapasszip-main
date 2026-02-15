@echo off
setlocal
title GuardiaPass Startup

echo [GuardiaPass] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js LTS from https://nodejs.org and reopen PowerShell/CMD.
  exit /b 1
)

echo [GuardiaPass] Checking npm...
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not installed or not in PATH.
  echo Reinstall Node.js LTS from https://nodejs.org with "Add to PATH" enabled.
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    echo [GuardiaPass] Creating .env from .env.example
    copy /Y ".env.example" ".env" >nul
  )
)

if not exist "node_modules" (
  echo [GuardiaPass] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else (
  echo [GuardiaPass] Dependencies already installed.
)

echo [GuardiaPass] Starting app...
call npm run dev
