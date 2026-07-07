# ProjectOwl — Setup Script (Windows / PowerShell)
param()

Write-Host "🦉 ProjectOwl — Setting up development environment" -ForegroundColor Cyan

# ── Check for Node.js ────────────────────────────────────────────────
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js is required. Install it from https://nodejs.org (v18+)" -ForegroundColor Red
    exit 1
}

$majorVersion = [int]($nodeVersion -replace "[v\.].*$", "")
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

# ── Check for build tools (needed by better-sqlite3) ─────────────────
$vcVarsAvailable = $false
try {
    # Check if MSVC build tools are available via common locations
    $msvcPaths = @(
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
    )
    $vcVarsAvailable = ($msvcPaths | Where-Object { Test-Path $_ }).Count -gt 0
}
catch { }

if (-not $vcVarsAvailable) {
    Write-Host ""
    Write-Host "⚠️  Visual Studio Build Tools not detected." -ForegroundColor Yellow
    Write-Host "   better-sqlite3 requires a C++ compiler (node-gyp) to build." -ForegroundColor Yellow
    Write-Host "   Install it by running the following in an admin terminal:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   npm install --global windows-build-tools" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Or install Visual Studio 2022 Community with 'Desktop development with C++'" -ForegroundColor Yellow
    Write-Host "   https://visualstudio.microsoft.com/downloads/" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "   Continue anyway? (y/N)"
    if ($continue -notin @('y', 'Y', 'yes', 'YES')) {
        exit 1
    }
}
else {
    Write-Host "✓ Build tools detected (MSVC)" -ForegroundColor Green
}

# ── Create data directory ────────────────────────────────────────────
if (-not (Test-Path data)) {
    New-Item -ItemType Directory -Path data -Force | Out-Null
}
Write-Host "✓ Data directory ready (SQLite database will be auto-created)" -ForegroundColor Green

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
Write-Host "📌  SQLite database lives in: data\projectowl.db" -ForegroundColor Cyan
Write-Host "    Delete it to reset all data (re-created on restart)" -ForegroundColor Cyan
