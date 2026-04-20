#!/bin/bash
# ============================================================================
# OPC Agent 一键安装脚本 (macOS / Linux / WSL)
# 用法: curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash
# 高级: curl -fsSL ... | bash -s -- --no-ollama
# ============================================================================

set -e

# ── 颜色 & Emoji ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}"; }
step()  { echo -e "\n${BLUE}${BOLD}━━━ $1 ━━━${NC}"; }

# ── 参数解析 ──────────────────────────────────────────────────
SKIP_OLLAMA=false
for arg in "$@"; do
  case "$arg" in
    --no-ollama) SKIP_OLLAMA=true ;;
  esac
done

# ── Banner ────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "   ___  ____  ____    _                    _   "
echo "  / _ \|  _ \/ ___|  / \   __ _  ___ _ __ | |_ "
echo " | | | | |_) \___ \ / _ \ / _\` |/ _ \ '_ \| __|"
echo " | |_| |  __/ ___) / ___ \ (_| |  __/ | | | |_ "
echo "  \___/|_|   |____/_/   \_\__, |\___|_| |_|\__|"
echo "                          |___/                 "
echo -e "${NC}"
info "一键安装 OPC Agent / One-line installer for OPC Agent"
echo ""

# ── 检测操作系统 ──────────────────────────────────────────────
step "🔍 检测操作系统 / Detecting OS"
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"; ok "macOS detected"
elif grep -qi microsoft /proc/version 2>/dev/null; then
  OS="wsl"; ok "WSL (Windows Subsystem for Linux) detected"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"; ok "Linux detected"
else
  err "不支持的操作系统 / Unsupported OS: $OSTYPE"
  err "修复建议 / Fix: 请使用 macOS、Linux 或 WSL"
  exit 1
fi

# ── 检测 Node.js ─────────────────────────────────────────────
step "📦 检测 Node.js (>=18) / Checking Node.js"

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge 18 ]; then
    ok "Node.js $(node -v) ✓"
  else
    err "Node.js $(node -v) 版本过低 / version too old (need >=18)"
    err "修复建议 / Fix:"
    echo "  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
    echo "  nvm install 22"
    echo "  # 或访问 / or visit: https://nodejs.org/"
    exit 1
  fi
else
  err "未检测到 Node.js / Node.js not found"
  err "修复建议 / Fix:"
  echo "  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
  echo "  source ~/.bashrc && nvm install 22"
  echo "  # 或访问 / or visit: https://nodejs.org/"
  exit 1
fi

# ── 检测 npm ─────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  err "未检测到 npm / npm not found"
  err "修复建议 / Fix: 重新安装 Node.js (npm 会一并安装)"
  exit 1
fi

# ── 安装 OPC Agent ────────────────────────────────────────────
step "🚀 安装 OPC Agent / Installing OPC Agent"
info "运行 npm install -g opc-agent ..."
npm install -g opc-agent

OPC_VER=$(opc --version 2>/dev/null || echo "unknown")
ok "OPC Agent v${OPC_VER} 安装成功 / installed successfully"

# ── 初始化 ────────────────────────────────────────────────────
step "⚙️  初始化 OPC Agent / Initializing"
info "运行 opc init --yes ..."
opc init --yes && ok "初始化完成 / initialized" || warn "初始化跳过（可能已初始化）/ init skipped (may already exist)"

# ── 环境检查 ──────────────────────────────────────────────────
step "🩺 环境检查 / Running Doctor"
info "运行 opc doctor ..."
opc doctor || warn "部分检查未通过，请查看上方输出 / Some checks failed, see above"

# ── Ollama（可选）─────────────────────────────────────────────
if ! $SKIP_OLLAMA; then
  step "🦙 检测 Ollama (可选) / Checking Ollama (optional)"

  if command -v ollama &>/dev/null; then
    ok "Ollama 已安装 / installed ✓"
  else
    warn "未检测到 Ollama / Ollama not found"
    info "Ollama 可让你在本地运行 AI 模型（免费、隐私安全）"
    info "Ollama lets you run AI models locally (free & private)"
    info "安装方法 / Install: curl -fsSL https://ollama.com/install.sh | sh"
    info "或访问 / or visit: https://ollama.com/download"
  fi
fi

# ── 完成 ──────────────────────────────────────────────────────
step "🎉 安装完成！/ Installation Complete!"
echo ""
echo -e "${GREEN}┌──────────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│                                                      │${NC}"
echo -e "${GREEN}│  🎊 OPC Agent 已就绪！/ OPC Agent is ready!          │${NC}"
echo -e "${GREEN}│                                                      │${NC}"
echo -e "${GREEN}│  快速开始 / Quick Start:                             │${NC}"
echo -e "${GREEN}│                                                      │${NC}"
echo -e "${GREEN}│    opc chat             💬 开始对话 / Start chat     │${NC}"
echo -e "${GREEN}│    opc init my-agent    📁 创建新 Agent              │${NC}"
echo -e "${GREEN}│    opc studio           🖥️  打开面板 / Dashboard     │${NC}"
echo -e "${GREEN}│    opc --help           📖 查看帮助 / Help           │${NC}"
echo -e "${GREEN}│                                                      │${NC}"
echo -e "${GREEN}│  无需全局安装也可使用 / Without global install:       │${NC}"
echo -e "${GREEN}│    npx opc-agent chat                                │${NC}"
echo -e "${GREEN}│    npx opc-agent init my-agent                       │${NC}"
echo -e "${GREEN}│                                                      │${NC}"
echo -e "${GREEN}│  文档 / Docs: https://github.com/Deepleaper/opc-agent│${NC}"
echo -e "${GREEN}│                                                      │${NC}"
echo -e "${GREEN}└──────────────────────────────────────────────────────┘${NC}"
echo ""
