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

# ── Check build tools (needed by better-sqlite3 native addon) ────────
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS — check for Xcode Command Line Tools
  if ! xcode-select -p &>/dev/null && ! pkgutil --pkg-info=com.apple.pkg.CLTools_Executables &>/dev/null 2>&1; then
    echo ""
    echo "⚠️  Xcode Command Line Tools not detected."
    echo "   better-sqlite3 requires a C++ compiler to build."
    echo "   Install it by running:"
    echo "     xcode-select --install"
    echo ""
    echo "   After installation, re-run this script."
    echo ""
    read -rp "   Continue anyway? (y/N) " REPLY
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
      exit 1
    fi
  else
    echo "✓ Build tools detected (Xcode CLT)"
  fi
elif [[ "$(uname)" == "Linux" ]]; then
  # Linux — check for g++ / build-essential
  if ! command -v g++ &>/dev/null && ! command -v clang++ &>/dev/null; then
    echo ""
    echo "⚠️  C++ compiler not detected."
    echo "   better-sqlite3 requires build-essential to compile."
    echo "   Install it by running:"
    echo "     sudo apt-get install build-essential python3   # Debian/Ubuntu"
    echo "     sudo yum groupinstall 'Development Tools'      # RHEL/Fedora"
    echo ""
    read -rp "   Continue anyway? (y/N) " REPLY
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
      exit 1
    fi
  else
    echo "✓ Build tools detected"
  fi
fi

# ── Create data directory ────────────────────────────────────────────
mkdir -p data
echo "✓ Data directory ready (SQLite database will be auto-created)"

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
echo ""
echo "📌  First visit: pick your name from the user list"
echo "    (seed data: You, Alex, Ben, Chloe, Diana)"
echo ""
echo "📌  SQLite database lives in: data/projectowl.db"
echo "    Delete it to reset all data (re-created on restart)"
