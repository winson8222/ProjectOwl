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
