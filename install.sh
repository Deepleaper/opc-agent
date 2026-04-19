#!/bin/bash
# ============================================================================
# OPC Agent 一键安装脚本 (macOS / Linux / WSL)
# 用法: curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash
# 高级: curl -fsSL ... | bash -s -- --yes --no-ollama
# ============================================================================

set -e

# ── 颜色 & Emoji ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}"; }
step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# ── 参数解析 ──────────────────────────────────────────────────
AUTO_YES=false
SKIP_OLLAMA=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y)       AUTO_YES=true ;;
    --no-ollama)    SKIP_OLLAMA=true ;;
  esac
done

confirm() {
  if $AUTO_YES; then return 0; fi
  read -r -p "$(echo -e "${YELLOW}❓ $1 [Y/n]: ${NC}")" choice
  case "$choice" in n|N|no|NO) return 1 ;; *) return 0 ;; esac
}

# ── 检测操作系统 ──────────────────────────────────────────────
step "🔍 检测操作系统 / Detecting OS"
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
  ok "macOS detected"
elif grep -qi microsoft /proc/version 2>/dev/null; then
  OS="wsl"
  ok "WSL (Windows Subsystem for Linux) detected"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
  ok "Linux detected"
else
  err "不支持的操作系统 / Unsupported OS: $OSTYPE"
  exit 1
fi

# ── 检测 & 安装 Node.js ──────────────────────────────────────
step "📦 检测 Node.js / Checking Node.js"
NEED_NODE=false

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge 18 ]; then
    ok "Node.js $(node -v) 已安装 / installed"
  else
    warn "Node.js $(node -v) 版本过低，需要 18+ / version too old, need 18+"
    NEED_NODE=true
  fi
else
  warn "未检测到 Node.js / Node.js not found"
  NEED_NODE=true
fi

if $NEED_NODE; then
  info "将通过 nvm 安装 Node.js 22 LTS / Installing Node.js 22 via nvm"
  if confirm "安装 Node.js 22? / Install Node.js 22?"; then
    if command -v nvm &>/dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
      [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
      info "nvm 已存在，安装 Node 22... / nvm found, installing Node 22..."
    else
      info "安装 nvm... / Installing nvm..."
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    fi
    nvm install 22
    nvm use 22
    ok "Node.js $(node -v) 安装成功 / installed successfully"
  else
    err "Node.js 是必需的 / Node.js is required"
    echo "手动安装 / Manual install: https://nodejs.org/"
    exit 1
  fi
fi

# ── 安装 OPC Agent ────────────────────────────────────────────
step "🚀 安装 OPC Agent / Installing OPC Agent"
info "npm install -g opc-agent ..."
npm install -g opc-agent
ok "OPC Agent $(opc --version 2>/dev/null || echo '') 安装成功 / installed"

# ── Ollama（可选）─────────────────────────────────────────────
if ! $SKIP_OLLAMA; then
  step "🦙 检测 Ollama / Checking Ollama"

  if command -v ollama &>/dev/null; then
    ok "Ollama 已安装 / installed ($(ollama --version 2>/dev/null || echo 'ok'))"
  else
    warn "未检测到 Ollama / Ollama not found"
    info "Ollama 可让你在本地运行 AI 模型（免费、数据不出门）"
    info "Ollama lets you run AI models locally (free, private)"

    if confirm "安装 Ollama? / Install Ollama?"; then
      if [ "$OS" = "macos" ]; then
        if command -v brew &>/dev/null; then
          brew install ollama
        else
          info "请从 https://ollama.com/download 下载安装"
          info "Download from https://ollama.com/download"
          open "https://ollama.com/download" 2>/dev/null || true
        fi
      else
        curl -fsSL https://ollama.com/install.sh | sh
      fi
      ok "Ollama 安装成功 / installed"
    else
      info "跳过 Ollama / Skipping Ollama"
    fi
  fi

  # 拉取推荐模型
  if command -v ollama &>/dev/null; then
    step "🧠 推荐模型 / Recommended Models"
    info "推荐拉取以下模型用于本地 Agent："
    info "  • qwen2.5:7b — 中英文对话（4.7GB）"
    info "  • nomic-embed-text — 文本向量化（274MB）"

    if confirm "拉取推荐模型? / Pull recommended models?"; then
      info "拉取 qwen2.5:7b ... (可能需要几分钟)"
      ollama pull qwen2.5:7b && ok "qwen2.5:7b ✓" || warn "qwen2.5:7b 拉取失败，可稍后手动: ollama pull qwen2.5:7b"

      info "拉取 nomic-embed-text ..."
      ollama pull nomic-embed-text && ok "nomic-embed-text ✓" || warn "拉取失败，可稍后手动: ollama pull nomic-embed-text"
    fi
  fi
fi

# ── 启动 Studio ───────────────────────────────────────────────
step "🎉 安装完成！/ Installation Complete!"
echo ""
echo -e "${GREEN}┌─────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  OPC Agent 已安装成功！                          │${NC}"
echo -e "${GREEN}│  OPC Agent installed successfully!               │${NC}"
echo -e "${GREEN}│                                                  │${NC}"
echo -e "${GREEN}│  快速开始 / Quick Start:                         │${NC}"
echo -e "${GREEN}│    opc init my-agent    # 创建 Agent             │${NC}"
echo -e "${GREEN}│    cd my-agent && npm i                          │${NC}"
echo -e "${GREEN}│    opc chat             # 开始对话               │${NC}"
echo -e "${GREEN}│                                                  │${NC}"
echo -e "${GREEN}│  可视化面板 / Dashboard:                          │${NC}"
echo -e "${GREEN}│    opc studio                                    │${NC}"
echo -e "${GREEN}│                                                  │${NC}"
echo -e "${GREEN}│  帮助 / Help:                                     │${NC}"
echo -e "${GREEN}│    opc --help                                    │${NC}"
echo -e "${GREEN}└─────────────────────────────────────────────────┘${NC}"
echo ""

if confirm "现在打开 OPC Studio? / Open OPC Studio now?"; then
  opc studio
fi
