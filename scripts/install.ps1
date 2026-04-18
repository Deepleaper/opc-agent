# OPC Agent — Windows installer
# Usage: irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/scripts/install.ps1 | iex

Write-Host "🤖 Installing OPC Agent..." -ForegroundColor Cyan

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is required. Install from https://nodejs.org (v18+)" -ForegroundColor Red
    exit 1
}

$nodeVer = (node -v) -replace 'v','' -split '\.' | Select-Object -First 1
if ([int]$nodeVer -lt 18) {
    Write-Host "❌ Node.js 18+ required (found $(node -v))" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing opc-agent globally..."
npm install -g opc-agent

Write-Host "`n✅ OPC Agent installed!" -ForegroundColor Green
Write-Host @"

Quick start:
  opc init my-agent
  cd my-agent
  npm install
  opc chat

Run 'opc doctor' to check your environment.
"@
