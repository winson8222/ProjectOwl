# ProjectOwl — Setup Script (Windows / PowerShell)
param()

# Fixed local-dev Postgres password — every contributor's machine ends up
# with the same superuser password, so setup never depends on anyone
# remembering a password they set once during an installer dialog.
# Dev-only: staging/prod use Supabase connection strings from real secrets,
# never this script.
$LocalPgPassword = "postgres"

Write-Host "🦉 ProjectOwl — Setting up development environment" -ForegroundColor Cyan

# ── Check for Node.js ────────────────────────────────────────────────
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js is required. Install it from https://nodejs.org (v18+)" -ForegroundColor Red
    exit 1
}

$majorVersion = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($majorVersion -lt 18) {
    Write-Host "❌ Node.js v18+ required. Current: $nodeVersion" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js $nodeVersion" -ForegroundColor Green

# ── Check for npm ────────────────────────────────────────────────────
$npmVersion = npm --version 2>$null
if (-not $npmVersion) {
    Write-Host "❌ npm is required (comes with Node.js)" -ForegroundColor Red
    exit 1
}
Write-Host "✓ npm $npmVersion" -ForegroundColor Green

# ── PostgreSQL ───────────────────────────────────────────────────────
# The app uses Postgres 16 (same major version as CI / Supabase).
$pgDb = "projectowl"
$pgDataDir = "$env:ProgramFiles\PostgreSQL\16\data"

function Add-PgBinToPath {
    $defaultBin = "$env:ProgramFiles\PostgreSQL\16\bin"
    if ((Test-Path $defaultBin) -and ($env:Path -notlike "*$defaultBin*")) {
        $env:Path = "$defaultBin;$env:Path"
    }
}

# psql may be installed but not on PATH yet within this process.
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Add-PgBinToPath
    $psql = Get-Command psql -ErrorAction SilentlyContinue
}

if (-not $psql) {
    Write-Host ""
    Write-Host "📦 PostgreSQL not found — installing PostgreSQL 16 silently..." -ForegroundColor Yellow
    Write-Host "   (one UAC prompt — installing a Windows service needs admin rights)" -ForegroundColor Yellow

    # --override forwards unattended-install flags straight to the EDB
    # installer: no UI, no prompts, and the superuser password fixed to
    # $LocalPgPassword so every fresh install matches the convention.
    $overrideArgs = "--mode unattended --unattendedmodeui minimal --superpassword $LocalPgPassword --servicename postgresql-x64-16"
    $wingetArgs = @(
        "install", "--id", "PostgreSQL.PostgreSQL.16", "--silent",
        "--accept-package-agreements", "--accept-source-agreements",
        "--override", $overrideArgs
    )
    $proc = Start-Process winget -ArgumentList $wingetArgs -Verb RunAs -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Host ""
        Write-Host "❌ Automated install failed (exit $($proc.ExitCode)). Install manually:" -ForegroundColor Red
        Write-Host "     winget install PostgreSQL.PostgreSQL.16" -ForegroundColor Cyan
        Write-Host "   Then re-run this script." -ForegroundColor Red
        exit 1
    }

    Add-PgBinToPath
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psql) {
        Write-Host "❌ Installed, but psql still isn't on PATH. Open a new terminal and re-run this script." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ PostgreSQL 16 installed" -ForegroundColor Green
}
else {
    Write-Host "✓ PostgreSQL detected ($(psql --version))" -ForegroundColor Green
}

# Make sure the service is running (name varies: postgresql-x64-16, postgresql-16, ...)
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService -and $pgService.Status -ne "Running") {
    Write-Host "⏳ Starting PostgreSQL service ($($pgService.Name))..." -ForegroundColor Yellow
    Start-Service $pgService.Name
}

# ── Make sure the postgres user's password matches the dev convention ──
# Handles the case of a pre-existing install (or a manual/GUI install)
# whose password doesn't match $LocalPgPassword — resets it via a brief
# trust-auth window instead of asking anyone to remember anything.
$env:PGPASSWORD = $LocalPgPassword
psql -U postgres -tAc "SELECT 1" *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "🔧 postgres user's password doesn't match the dev convention — resetting it..." -ForegroundColor Yellow
    Write-Host "   (one UAC prompt — briefly enables trust auth to reset it, then reverts)" -ForegroundColor Yellow

    if (-not $pgService -or -not (Test-Path $pgDataDir)) {
        Write-Host "❌ Could not locate the PostgreSQL service/data directory to reset the password." -ForegroundColor Red
        Write-Host "   Reset it manually to '$LocalPgPassword' (see README) and re-run this script." -ForegroundColor Red
        exit 1
    }

    $resetScript = @"
`$hba = '$pgDataDir\pg_hba.conf'
Copy-Item `$hba "`$hba.bak" -Force
(Get-Content `$hba) -replace 'scram-sha-256|md5', 'trust' | Set-Content `$hba
Restart-Service '$($pgService.Name)' -Force
Start-Sleep -Seconds 2
`$env:PGPASSWORD = `$null
psql -U postgres -c "ALTER USER postgres PASSWORD '$LocalPgPassword'" | Out-Null
Copy-Item "`$hba.bak" `$hba -Force
Restart-Service '$($pgService.Name)' -Force
"@
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($resetScript))
    Start-Process powershell -ArgumentList "-NoProfile -NonInteractive -EncodedCommand $encoded" -Verb RunAs -Wait

    Start-Sleep -Seconds 2
    $env:PGPASSWORD = $LocalPgPassword
    psql -U postgres -tAc "SELECT 1" *>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Password reset didn't take. Check the service is running and re-run this script." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ postgres password reset to match the dev convention" -ForegroundColor Green
}

# ── Create the database if missing ───────────────────────────────────
# $env:PGPASSWORD (set above) means none of this prompts interactively.
Write-Host ""
Write-Host "🗄️  Ensuring database '$pgDb' exists..." -ForegroundColor Yellow
$dbExists = (psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$pgDb'" 2>$null | Out-String).Trim()
if ($dbExists -ne "1") {
    psql -U postgres -c "CREATE DATABASE $pgDb" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Could not create database '$pgDb'. Create it manually:" -ForegroundColor Red
        Write-Host "     psql -U postgres -c `"CREATE DATABASE $pgDb`"" -ForegroundColor Cyan
        Write-Host "   Then re-run this script." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Created database '$pgDb'" -ForegroundColor Green
}
else {
    Write-Host "✓ Database '$pgDb' already exists" -ForegroundColor Green
}

# ── Install dependencies ─────────────────────────────────────────────
Write-Host "`n📦 Installing npm dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# ── Create .env.local if missing ─────────────────────────────────────
if (-not (Test-Path .env.local)) {
    Write-Host "`n🔑 Creating .env.local from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env.local
    Write-Host "`n⚠️   Edit .env.local and add your GEMINI_API_KEY" -ForegroundColor Yellow
    Write-Host "    Get one at: https://aistudio.google.com/apikey" -ForegroundColor Yellow
}
else {
    Write-Host "✓ .env.local already exists" -ForegroundColor Green
}

# ── Ensure DATABASE_URL is set (and matches the convention) ──────────
# No prompt — always the dev-convention password, so this line is
# reproducible byte-for-byte on every contributor's machine. Rewrites a
# pre-existing but mismatched value too (e.g. a stale password from
# before this convention existed) instead of silently leaving it wrong.
$expectedUrl = "DATABASE_URL=postgresql://postgres:$LocalPgPassword@localhost:5432/$pgDb"
$envContent = Get-Content .env.local -Raw -ErrorAction SilentlyContinue
if ($envContent -notmatch "(?m)^DATABASE_URL=") {
    Add-Content .env.local $expectedUrl
    Write-Host "✓ Added DATABASE_URL to .env.local" -ForegroundColor Green
}
elseif ($envContent -notmatch [regex]::Escape($expectedUrl)) {
    $updated = $envContent -replace "(?m)^DATABASE_URL=.*$", $expectedUrl
    Set-Content .env.local -Value $updated -NoNewline
    Write-Host "✓ DATABASE_URL was stale — updated to match the dev convention" -ForegroundColor Yellow
}
else {
    Write-Host "✓ DATABASE_URL already set correctly in .env.local" -ForegroundColor Green
}

# ── Migrate + seed ───────────────────────────────────────────────────
Write-Host "`n🗄️  Applying database migrations..." -ForegroundColor Yellow
npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration failed — check DATABASE_URL in .env.local" -ForegroundColor Red
    exit 1
}
Write-Host "🌱 Seeding demo data (no-op if already seeded)..." -ForegroundColor Yellow
npm run db:seed

# ── Build check ──────────────────────────────────────────────────────
Write-Host "`n🏗️  Running build check..." -ForegroundColor Yellow
npx next build 2>&1 | Select-Object -Last 8

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "`n🚀  Start the dev server:  npm run dev" -ForegroundColor Cyan
Write-Host "    Open:                  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "📌  First visit: pick your name from the user list" -ForegroundColor Cyan
Write-Host "    (seed data: You, Alex, Ben, Chloe, Diana)" -ForegroundColor Cyan
Write-Host ""
Write-Host "📌  Database: PostgreSQL '$pgDb' on localhost:5432 (user: postgres / pw: $LocalPgPassword)" -ForegroundColor Cyan
Write-Host "    Reset all data:  POST http://localhost:3000/api/debug?action=reset" -ForegroundColor Cyan
