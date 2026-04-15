# Code Reviewer Template

AI-powered code reviewer that catches bugs and suggests improvements.

## Features
- **Bug Detection**: Finds potential bugs and security issues
- **Style Checks**: Enforces coding best practices
- **Improvement Suggestions**: Actionable refactoring advice
- **Severity Ratings**: 🔴 Critical | 🟡 Warning | 🔵 Info

## Quick Start
```bash
opc init my-reviewer --template code-reviewer
cd my-reviewer
opc run
```

## Usage
Send code via the web or WebSocket channel:
```json
{
  "message": "Review this:\n```python\ndef calc(x):\n    return eval(x)\n```"
}
```

## Configuration
Customize the system prompt in `oad.yaml` to focus on specific languages or coding standards.
