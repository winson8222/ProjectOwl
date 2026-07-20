#!/usr/bin/env bash
# ProjectOwl — Setup Script (macOS / Linux)
set -euo pipefail

# Fixed local-dev Postgres password — every contributor's machine ends up
# with the same superuser password, so setup never depends on anyone
# remembering a password they set once during an installer prompt.
# Dev-only: staging/prod use Supabase connection strings from real secrets,
# never this script.
LOCAL_PG_PASSWORD="postgres"

# By default `brew install <formula>` also upgrades every other outdated
# formula on the machine that depends on the same libraries (e.g. installing
# postgresql@16 has, on real machines, dragged in unrelated upgrades of
# Node, Python, nginx — slow, disruptive, and if any of THEIR post-install
# hooks fail, `brew install` reports failure even though the formula we
# wanted installed fine). Scope brew calls in this script to just what they
# ask for.
export HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1
export HOMEBREW_NO_INSTALL_CLEANUP=1

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
#
# We key everything off whether the *server* actually answers
# (pg_isready), not whether a `psql` binary is on PATH — a client-only
# library (e.g. libpq, which several unrelated tools pull in) puts psql
# on PATH without any server behind it, so `command -v psql` alone is
# not a reliable signal that Postgres is usable.
PG_DB="projectowl"

if pg_isready -q 2>/dev/null; then
  echo "✓ PostgreSQL server is running ($(psql --version 2>/dev/null || echo 'client not found'))"
else
  echo ""
  echo "⚙️  No PostgreSQL server responding — installing/starting one..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
      PG_SERVICE=$(brew list --formula 2>/dev/null | grep -E '^postgresql(@[0-9]+)?$' | head -1)
      if [ -z "$PG_SERVICE" ]; then
        echo "📦 Installing postgresql@16 via Homebrew..."
        brew install postgresql@16
        PG_SERVICE="postgresql@16"
      fi
      # brew's postgresql@NN is keg-only; make psql/createdb/initdb available now
      export PATH="$(brew --prefix "$PG_SERVICE")/bin:$PATH"

      # Some Homebrew versions of this formula ship no post_install hook,
      # so `brew install` alone never runs initdb — the data directory
      # (and thus the "database cluster" the formula's own caveats claim
      # to have created) may simply not exist. `brew services start`
      # doesn't fail loudly in that case; postgres just can't find its
      # data dir and pg_isready stays down. Create the cluster ourselves
      # if it's missing.
      PG_DATA_DIR="$(brew --prefix)/var/$PG_SERVICE"
      if [ ! -s "$PG_DATA_DIR/PG_VERSION" ]; then
        echo "🗄️  Initializing PostgreSQL data directory at $PG_DATA_DIR..."
        rm -rf "$PG_DATA_DIR"
        initdb --locale=C -E UTF-8 "$PG_DATA_DIR" >/dev/null
      fi

      brew services start "$PG_SERVICE"
      for _ in $(seq 1 10); do
        pg_isready -q 2>/dev/null && break
        sleep 1
      done
    else
      echo "❌ PostgreSQL is required. Install Homebrew (https://brew.sh) then run:"
      echo "     brew install postgresql@16 && brew services start postgresql@16"
      exit 1
    fi
  elif command -v apt-get &>/dev/null; then
    echo "📦 Installing postgresql via apt..."
    sudo apt-get update && sudo apt-get install -y postgresql
    sudo systemctl enable --now postgresql
    for _ in $(seq 1 10); do
      pg_isready -q 2>/dev/null && break
      sleep 1
    done
  else
    echo "❌ PostgreSQL is required and no supported package manager (brew/apt) was found."
    echo "   Install PostgreSQL 16 and start it, then re-run this script."
    exit 1
  fi

  if ! pg_isready -q 2>/dev/null; then
    echo "❌ PostgreSQL was installed but the server still isn't responding."
    echo "   macOS (brew):  brew services start postgresql@16"
    echo "   Linux:         sudo systemctl start postgresql"
    echo "   Then re-run this script."
    exit 1
  fi
  echo "✓ PostgreSQL server installed and running"
fi

if ! command -v psql &>/dev/null; then
  echo "❌ PostgreSQL server is running but the 'psql' client isn't on PATH."
  echo "   Add it to PATH (e.g. $(brew --prefix postgresql@16 2>/dev/null)/bin) and re-run this script."
  exit 1
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
