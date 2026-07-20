#!/usr/bin/env bash
# ProjectOwl — Setup Script (macOS / Linux)
set -euo pipefail

# Fixed local-dev Postgres password — every contributor's machine ends up
# with the same superuser password, so setup never depends on anyone
# remembering a password they set once during an installer prompt.
# Dev-only: staging/prod use Supabase connection strings from real secrets,
# never this script.
LOCAL_PG_PASSWORD="postgres"

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

# ── PostgreSQL ───────────────────────────────────────────────────────
# The app uses Postgres 16 (same major version as CI / Supabase).
PG_DB="projectowl"

if ! command -v psql &>/dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
      echo ""
      echo "📦 PostgreSQL not found — installing postgresql@16 via Homebrew..."
      brew install postgresql@16
      brew services start postgresql@16
      # brew's postgresql@16 is keg-only; make psql/createdb available now
      export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
      echo "✓ PostgreSQL 16 installed and started (runs on login via brew services)"
      echo "  Tip: add $(brew --prefix postgresql@16)/bin to your PATH for psql access"
    else
      echo "❌ PostgreSQL is required. Install Homebrew (https://brew.sh) then run:"
      echo "     brew install postgresql@16 && brew services start postgresql@16"
      exit 1
    fi
  else
    echo "❌ PostgreSQL is required. On Debian/Ubuntu:"
    echo "     sudo apt-get install postgresql-16"
    echo "     sudo systemctl enable --now postgresql"
    echo "   Then re-run this script."
    exit 1
  fi
else
  echo "✓ PostgreSQL detected ($(psql --version))"
fi

# ── Ensure a 'postgres' role exists with the dev-convention password ───
# brew/apt Postgres trusts local connections by default (no password
# needed to reach this point), but doesn't create a "postgres" role —
# it's peer-authenticated as your OS user. Creating one here means the
# DATABASE_URL format matches Windows exactly across the whole team.
if ! psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" 2>/dev/null | grep -q 1; then
  createuser -s postgres 2>/dev/null || true
fi
psql -d postgres -c "ALTER USER postgres PASSWORD '$LOCAL_PG_PASSWORD'" >/dev/null
echo "✓ postgres role password set to the dev convention"

# ── Create the database if missing ───────────────────────────────────
if PGPASSWORD="$LOCAL_PG_PASSWORD" psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$PG_DB"; then
  echo "✓ Database '$PG_DB' already exists"
else
  if PGPASSWORD="$LOCAL_PG_PASSWORD" createdb -U postgres "$PG_DB" 2>/dev/null; then
    echo "✓ Created database '$PG_DB'"
  else
    echo "⚠️  Could not create database '$PG_DB' automatically."
    echo "   Create it yourself (createdb -U postgres $PG_DB) and re-run this script."
    exit 1
  fi
fi

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

# ── Ensure DATABASE_URL is set (and matches the convention) ──────────
# No prompt — always the dev-convention password, so this line is
# reproducible byte-for-byte on every contributor's machine. Rewrites a
# pre-existing but mismatched value too (e.g. a stale password from
# before this convention existed) instead of silently leaving it wrong.
EXPECTED_URL="DATABASE_URL=postgresql://postgres:$LOCAL_PG_PASSWORD@localhost:5432/$PG_DB"
if ! grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
  echo "$EXPECTED_URL" >> .env.local
  echo "✓ Added DATABASE_URL to .env.local"
elif ! grep -qF "$EXPECTED_URL" .env.local; then
  sed -i.bak "s|^DATABASE_URL=.*|$EXPECTED_URL|" .env.local
  rm -f .env.local.bak
  echo "✓ DATABASE_URL was stale — updated to match the dev convention"
else
  echo "✓ DATABASE_URL already set correctly in .env.local"
fi

# ── Migrate + seed ───────────────────────────────────────────────────
echo ""
echo "🗄️  Applying database migrations..."
npm run db:migrate
echo "🌱 Seeding demo data (no-op if already seeded)..."
npm run db:seed

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
echo "📌  Database: PostgreSQL '$PG_DB' on localhost:5432 (user: postgres / pw: $LOCAL_PG_PASSWORD)"
echo "    Reset all data:  POST http://localhost:3000/api/debug?action=reset"
echo "    Or:              dropdb $PG_DB && createdb $PG_DB && npm run db:migrate && npm run db:seed"
