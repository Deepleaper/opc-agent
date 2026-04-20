# ============================================================================
# OPC Agent 一键安装脚本 for Windows PowerShell
# 用法: irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
# 高级: $env:OPC_NO_OLLAMA='1'; irm ... | iex
# ============================================================================

$ErrorActionPreference = "Stop"

# ── 颜色输出 ──────────────────────────────────────────────────
function Write-Step($msg)  { Write-Host "`n━━━ $msg ━━━" -ForegroundColor Blue }
function Write-Ok($msg)    { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info($msg)  { Write-Host "ℹ️  $msg" -ForegroundColor Cyan }

$SkipOllama = $env:OPC_NO_OLLAMA -eq '1'

# ── Banner ────────────────────────────────────────────────────
Write-Host ""
Write-Host "   ___  ____  ____    _                    _   " -ForegroundColor Cyan
Write-Host "  / _ \|  _ \/ ___|  / \   __ _  ___ _ __ | |_ " -ForegroundColor Cyan
Write-Host " | | | | |_) \___ \ / _ \ / _`` |/ _ \ '_ \| __|" -ForegroundColor Cyan
Write-Host " | |_| |  __/ ___) / ___ \ (_| |  __/ | | | |_ " -ForegroundColor Cyan
Write-Host "  \___/|_|   |____/_/   \_\__, |\___|_| |_|\__|" -ForegroundColor Cyan
Write-Host "                          |___/                 " -ForegroundColor Cyan
Write-Host ""
Write-Info "一键安装 OPC Agent / One-line installer for OPC Agent"
Write-Host ""

# ── 检测操作系统 ──────────────────────────────────────────────
Write-Step "🔍 检测操作系统 / Detecting OS"
Write-Ok "Windows $([System.Environment]::OSVersion.Version) detected"

# ── 检测 Node.js ─────────────────────────────────────────────
Write-Step "📦 检测 Node.js (>=18) / Checking Node.js"

try {
    $nodeVerFull = (node -v)
    $nodeVerMajor = [int]($nodeVerFull -replace 'v','' -split '\.' | Select-Object -First 1)
    if ($nodeVerMajor -ge 18) {
        Write-Ok "Node.js $nodeVerFull ✓"
    } else {
        Write-Err "Node.js $nodeVerFull 版本过低 / version too old (need >=18)"
        Write-Err "修复建议 / Fix: winget install OpenJS.NodeJS.LTS"
        Write-Info "或访问 / or visit: https://nodejs.org/"
        exit 1
    }
} catch {
    Write-Err "未检测到 Node.js / Node.js not found"
    Write-Err "修复建议 / Fix:"
    Write-Info "  winget install OpenJS.NodeJS.LTS"
    Write-Info "  # 或访问 / or visit: https://nodejs.org/"
    exit 1
}

# ── 检测 npm ─────────────────────────────────────────────────
try { npm --version | Out-Null } catch {
    Write-Err "未检测到 npm / npm not found"
    Write-Err "修复建议 / Fix: 重新安装 Node.js"
    exit 1
}

# ── 安装 OPC Agent ────────────────────────────────────────────
Write-Step "🚀 安装 OPC Agent / Installing OPC Agent"
Write-Info "运行 npm install -g opc-agent ..."
npm install -g opc-agent
if ($LASTEXITCODE -ne 0) { Write-Err "安装失败 / Install failed"; exit 1 }

$opcVer = try { opc --version 2>$null } catch { "unknown" }
Write-Ok "OPC Agent v$opcVer 安装成功 / installed successfully"

# ── 初始化 ────────────────────────────────────────────────────
Write-Step "⚙️  初始化 OPC Agent / Initializing"
Write-Info "运行 opc init --yes ..."
try { opc init --yes; Write-Ok "初始化完成 / initialized" } catch { Write-Warn "初始化跳过（可能已初始化）/ init skipped" }

# ── 环境检查 ──────────────────────────────────────────────────
Write-Step "🩺 环境检查 / Running Doctor"
Write-Info "运行 opc doctor ..."
try { opc doctor } catch { Write-Warn "部分检查未通过，请查看上方输出 / Some checks failed" }

# ── Ollama（可选）─────────────────────────────────────────────
if (-not $SkipOllama) {
    Write-Step "🦙 检测 Ollama (可选) / Checking Ollama (optional)"

    $hasOllama = $false
    try { ollama --version 2>$null | Out-Null; $hasOllama = $true } catch {}

    if ($hasOllama) {
        Write-Ok "Ollama 已安装 / installed ✓"
    } else {
        Write-Warn "未检测到 Ollama / Ollama not found"
        Write-Info "Ollama 可让你在本地运行 AI 模型（免费、隐私安全）"
        Write-Info "Ollama lets you run AI models locally (free & private)"
        Write-Info "安装方法 / Install: winget install Ollama.Ollama"
        Write-Info "或访问 / or visit: https://ollama.com/download"
    }
}

# ── 完成 ──────────────────────────────────────────────────────
Write-Step "🎉 安装完成！/ Installation Complete!"
Write-Host ""
Write-Host "┌──────────────────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "│                                                      │" -ForegroundColor Green
Write-Host "│  🎊 OPC Agent 已就绪！/ OPC Agent is ready!          │" -ForegroundColor Green
Write-Host "│                                                      │" -ForegroundColor Green
Write-Host "│  快速开始 / Quick Start:                             │" -ForegroundColor Green
Write-Host "│                                                      │" -ForegroundColor Green
Write-Host "│    opc chat             💬 开始对话 / Start chat     │" -ForegroundColor Green
Write-Host "│    opc init my-agent    📁 创建新 Agent              │" -ForegroundColor Green
Write-Host "│    opc studio           🖥️  打开面板 / Dashboard     │" -ForegroundColor Green
Write-Host "│    opc --help           📖 查看帮助 / Help           │" -ForegroundColor Green
Write-Host "│                                                      │" -ForegroundColor Green
Write-Host "│  无需全局安装也可使用 / Without global install:       │" -ForegroundColor Green
Write-Host "│    npx opc-agent chat                                │" -ForegroundColor Green
Write-Host "│    npx opc-agent init my-agent                       │" -ForegroundColor Green
Write-Host "│                                                      │" -ForegroundColor Green
Write-Host "│  文档 / Docs: https://github.com/Deepleaper/opc-agent│" -ForegroundColor Green
Write-Host "│                                                      │" -ForegroundColor Green
Write-Host "└──────────────────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""
