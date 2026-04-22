# Task: OPC v5.0.0-rc.1 Polish

Do these 3 things:

## 1. Add spinner to src/cli/setup.ts
Add a simple ANSI spinner (no deps) for long operations:
- Detecting Ollama
- Downloading models
- Testing connections

Also add auto-install Ollama when --yes mode and Ollama not found:
- Linux/macOS: curl -fsSL https://ollama.com/install.sh | sh
- Windows: download+run OllamaSetup.exe silently
- Poll localhost:11434 until ready (max 60s)

Add a verification step after setup:
- Check opc --version
- Check ollama list
- Quick chat test (send "hi" to local model, verify response)
- Print summary box with all green checks

## 2. Rewrite README.md
For v5.0.0-rc.1. Brand: "OPC Agent — 瞬知 Studio". Include:
- One-line install commands (bash + PowerShell)  
- Quick start (init → chat → studio → run)
- Feature list (self-evolving, zero cost, multi-channel, Studio UI, 40 skills, A2A)
- Architecture diagram (text art)
- CLI commands table
Also create README.zh-CN.md (Chinese version)

## 3. Bump version
package.json version → "5.0.0-rc.1"

No external deps. npx tsc must pass. git commit when done.
