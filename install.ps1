# ============================================================================
# OPC Agent 一键安装脚本 for Windows
# 用法: irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
# 高级: $env:OPC_YES='1'; $env:OPC_NO_OLLAMA='1'; irm ... | iex
# ============================================================================

$ErrorActionPreference = "Stop"

# ── 颜色输出 ──────────────────────────────────────────────────
function Write-Step($msg)  { Write-Host "`n━━━ $msg ━━━" -ForegroundColor Blue }
function Write-Ok($msg)    { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info($msg)  { Write-Host "ℹ️  $msg" -ForegroundColor Cyan }

$AutoYes    = $env:OPC_YES -eq '1'
$SkipOllama = $env:OPC_NO_OLLAMA -eq '1'

function Confirm-Action($prompt) {
    if ($AutoYes) { return $true }
    $choice = Read-Host "❓ $prompt [Y/n]"
    return ($choice -ne 'n' -and $choice -ne 'N' -and $choice -ne 'no')
}

# ── 检测操作系统 ──────────────────────────────────────────────
Write-Step "🔍 检测操作系统 / Detecting OS"
Write-Ok "Windows $([System.Environment]::OSVersion.Version) detected"

# ── 检测 & 安装 Node.js ──────────────────────────────────────
Write-Step "📦 检测 Node.js / Checking Node.js"
$NeedNode = $false

try {
    $nodeVer = (node -v) -replace 'v','' -split '\.' | Select-Object -First 1
    if ([int]$nodeVer -ge 18) {
        Write-Ok "Node.js $(node -v) 已安装 / installed"
    } else {
        Write-Warn "Node.js $(node -v) 版本过低，需要 18+ / version too old"
        $NeedNode = $true
    }
} catch {
    Write-Warn "未检测到 Node.js / Node.js not found"
    $NeedNode = $true
}

if ($NeedNode) {
    Write-Info "将安装 Node.js 22 LTS / Installing Node.js 22 LTS"
    if (Confirm-Action "安装 Node.js 22? / Install Node.js 22?") {
        $installed = $false
        # 尝试 winget
        try {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            $installed = $true
            Write-Ok "Node.js 通过 winget 安装成功 / installed via winget"
        } catch {}

        # 尝试 choco
        if (-not $installed) {
            try {
                choco install nodejs-lts -y
                $installed = $true
                Write-Ok "Node.js 通过 Chocolatey 安装成功 / installed via Chocolatey"
            } catch {}
        }

        if (-not $installed) {
            Write-Err "自动安装失败 / Auto-install failed"
            Write-Info "请手动下载安装 / Please download manually: https://nodejs.org/"
            Start-Process "https://nodejs.org/en/download/"
            exit 1
        }

        # 刷新 PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Write-Err "Node.js 是必需的 / Node.js is required"
        Write-Info "下载地址 / Download: https://nodejs.org/"
        exit 1
    }
}

# ── 安装 OPC Agent ────────────────────────────────────────────
Write-Step "🚀 安装 OPC Agent / Installing OPC Agent"
Write-Info "npm install -g opc-agent ..."
npm install -g opc-agent
Write-Ok "OPC Agent 安装成功 / installed"

# ── Ollama（可选）─────────────────────────────────────────────
if (-not $SkipOllama) {
    Write-Step "🦙 检测 Ollama / Checking Ollama"

    $hasOllama = $false
    try { ollama --version 2>$null; $hasOllama = $true } catch {}

    if ($hasOllama) {
        Write-Ok "Ollama 已安装 / installed"
    } else {
        Write-Warn "未检测到 Ollama / Ollama not found"
        Write-Info "Ollama 可让你在本地运行 AI 模型（免费、数据不出门）"
        Write-Info "Ollama lets you run AI models locally (free, private)"

        if (Confirm-Action "安装 Ollama? / Install Ollama?") {
            try {
                winget install Ollama.Ollama --accept-package-agreements --accept-source-agreements
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
                Write-Ok "Ollama 安装成功 / installed"
                $hasOllama = $true
            } catch {
                Write-Warn "winget 安装失败，请手动下载 / Please download manually: https://ollama.com/download"
                Start-Process "https://ollama.com/download"
            }
        }
    }

    # 拉取推荐模型
    if ($hasOllama) {
        Write-Step "🧠 推荐模型 / Recommended Models"
        Write-Info "推荐拉取以下模型用于本地 Agent："
        Write-Info "  • qwen2.5:7b — 中英文对话（4.7GB）"
        Write-Info "  • nomic-embed-text — 文本向量化（274MB）"

        if (Confirm-Action "拉取推荐模型? / Pull recommended models?") {
            Write-Info "拉取 qwen2.5:7b ... (可能需要几分钟)"
            try { ollama pull qwen2.5:7b; Write-Ok "qwen2.5:7b ✓" } catch { Write-Warn "拉取失败，可稍后手动: ollama pull qwen2.5:7b" }

            Write-Info "拉取 nomic-embed-text ..."
            try { ollama pull nomic-embed-text; Write-Ok "nomic-embed-text ✓" } catch { Write-Warn "拉取失败，可稍后手动: ollama pull nomic-embed-text" }
        }
    }
}

# ── 完成 ──────────────────────────────────────────────────────
Write-Step "🎉 安装完成！/ Installation Complete!"
Write-Host ""
Write-Host "┌─────────────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "│  OPC Agent 已安装成功！                          │" -ForegroundColor Green
Write-Host "│  OPC Agent installed successfully!               │" -ForegroundColor Green
Write-Host "│                                                  │" -ForegroundColor Green
Write-Host "│  快速开始 / Quick Start:                         │" -ForegroundColor Green
Write-Host "│    opc init my-agent    # 创建 Agent             │" -ForegroundColor Green
Write-Host "│    cd my-agent; npm i                            │" -ForegroundColor Green
Write-Host "│    opc chat             # 开始对话               │" -ForegroundColor Green
Write-Host "│                                                  │" -ForegroundColor Green
Write-Host "│  可视化面板 / Dashboard:                          │" -ForegroundColor Green
Write-Host "│    opc studio                                    │" -ForegroundColor Green
Write-Host "│                                                  │" -ForegroundColor Green
Write-Host "│  帮助 / Help:                                     │" -ForegroundColor Green
Write-Host "│    opc --help                                    │" -ForegroundColor Green
Write-Host "└─────────────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""

if (Confirm-Action "现在打开 OPC Studio? / Open OPC Studio now?") {
    opc studio
}
