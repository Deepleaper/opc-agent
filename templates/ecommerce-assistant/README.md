# Ecommerce Assistant — 电商助手工位

专为电商平台设计的 AI 导购与售后工位，覆盖商品推荐、订单查询、退换货处理全链路。

## 快速开始

```bash
opc init --template ecommerce-assistant
opc start
```

访问 http://localhost:3000 即可使用电商助手聊天界面。

## 功能

| 技能 | 说明 |
|------|------|
| product-search | 关键词/类目/价格区间商品搜索 |
| order-query | 订单状态与物流实时查询 |
| after-sale | 退换货受理与投诉处理 |
| promotion | 个性化优惠券与促销推送 |
| recommendation | 基于偏好的个性化商品推荐 |

## 配置

在 `oad.yaml` 中修改以下参数：

- `spec.provider.default` — 切换 LLM 提供商（deepseek / openai / qwen）
- `spec.model` — 指定模型版本
- `spec.systemPrompt` — 定制品牌话术、商品范围和售后规则

### 环境变量

```bash
OPC_LLM_API_KEY=your_key
OPC_LLM_MODEL=deepseek-chat        # 可选，覆盖 oad.yaml 中的 model
OPC_DEEPBRAIN_ENABLED=true         # 启用 DeepBrain 知识库增强（需全局安装 deepbrain）
```

## 推荐搭配

- 将商品目录、售后政策、FAQ 上传至知识库（`/api/kb/upload`）
- 开启 `OPC_DEEPBRAIN_ENABLED=true` 提升商品语义匹配精度
- 通过 Dashboard（`/dashboard`）监控转化率、客满率和退单率
- 结合 CRM 系统 Webhook 实现订单状态实时同步
