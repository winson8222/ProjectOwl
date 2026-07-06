#!/usr/bin/env bash
# ProjectOwl — Setup Script (macOS / Linux)
set -euo pipefail

echo "🦉 ProjectOwl — Setting up development environment"

# ── Check for Node.js ────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is required. Install it from https://nodejs.org (v18+)"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js v18+ required. Current: $(node -v)"
  exit 1
fi
echo "✓ Node.js $(node -v)"

# ── Check for npm ────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo "❌ npm is required (comes with Node.js)"
  exit 1
fi
echo "✓ npm $(npm -v)"

# ── Install dependencies ─────────────────────────────────────────────
echo ""
echo "📦 Installing npm dependencies..."
npm install
echo "✓ Dependencies installed"

# ── Create .env.local if missing ─────────────────────────────────────
if [ ! -f .env.local ]; then
  echo ""
  echo "🔑 Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo ""
  echo "⚠️   Edit .env.local and add your GEMINI_API_KEY"
  echo "    Get one at: https://aistudio.google.com/apikey"
else
  echo "✓ .env.local already exists"
fi

# ── Build check ──────────────────────────────────────────────────────
echo ""
echo "🏗️  Running build check..."
npx next build 2>&1 | tail -8
echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀  Start the dev server:  npm run dev"
echo "    Open:                  http://localhost:3000"
