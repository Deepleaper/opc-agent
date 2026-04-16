# Tech Support Agent — 技术支持工位

专为 IT 支持团队设计的 AI 工位，覆盖软件故障、系统配置、网络问题等场景。

## 快速开始

```bash
opc init --template tech-support
opc start
```

访问 http://localhost:3000 即可使用技术支持聊天界面。

## 功能

| 技能 | 说明 |
|------|------|
| troubleshoot | 分步骤诊断和解决技术问题 |
| knowledge-lookup | 查询技术文档与历史解决方案 |
| ticket-create | 创建并跟踪技术支持工单 |
| escalate | 升级复杂问题至专项团队 |

## 配置

在 `oad.yaml` 中修改以下参数：

- `spec.provider.default` — 切换 LLM 提供商（deepseek / openai / qwen）
- `spec.model` — 指定模型版本
- `spec.systemPrompt` — 定制支持范围和话术风格

### 环境变量

```bash
OPC_LLM_API_KEY=your_key
OPC_LLM_MODEL=deepseek-chat        # 可选，覆盖 oad.yaml 中的 model
OPC_DEEPBRAIN_ENABLED=true         # 启用 DeepBrain 知识库增强（需全局安装 deepbrain）
```

## 推荐搭配

- 将内部技术文档、SOP、FAQ 上传至知识库（`/api/kb/upload`）
- 开启 `OPC_DEEPBRAIN_ENABLED=true` 获得更精准的语义检索
- 通过 Dashboard（`/dashboard`）监控首次解决率和平均响应时间
