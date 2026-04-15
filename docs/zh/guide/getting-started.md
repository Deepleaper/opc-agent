# 快速开始

## 安装

```bash
npm install -g opc-agent
```

## 创建项目

```bash
opc init my-agent
cd my-agent
```

## 配置

编辑 `.env` 文件，设置 API 密钥：

```bash
OPC_LLM_API_KEY=your-api-key
OPC_LLM_BASE_URL=https://api.openai.com/v1
OPC_LLM_MODEL=gpt-4o-mini
```

## 启动

```bash
# Web 服务器模式
opc run

# CLI 对话模式
opc chat
```

## 测试

```bash
opc test
```

## 查看分析

```bash
opc analytics
```

## 模板

使用 `-t` 指定模板：

```bash
opc init my-bot -t teacher
opc init my-bot -t data-analyst
opc init my-bot -t sales-assistant
```

共 13 个内置模板可选。
