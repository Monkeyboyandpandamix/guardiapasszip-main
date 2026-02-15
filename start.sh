#!/usr/bin/env bash
set -euo pipefail

echo "[GuardiaPass] Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed or not in PATH."
  echo "Install Node.js LTS from https://nodejs.org"
  exit 1
fi

echo "[GuardiaPass] Checking npm..."
if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed or not in PATH."
  echo "Reinstall Node.js LTS from https://nodejs.org"
  exit 1
fi

if [[ ! -f .env && -f .env.example ]]; then
  echo "[GuardiaPass] Creating .env from .env.example"
  cp .env.example .env
fi

if [[ ! -d node_modules ]]; then
  echo "[GuardiaPass] Installing dependencies..."
  npm install
else
  echo "[GuardiaPass] Dependencies already installed."
fi

echo "[GuardiaPass] Starting app..."
npm run dev
