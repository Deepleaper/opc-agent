# 测试

## 概述

OPC Agent 内置测试框架。在 `oad.yaml` 或 `tests.yaml` 中定义测试用例，然后用 `opc test` 运行。

## 快速开始

```bash
opc test
```

## 定义测试

### 在 oad.yaml 中

```yaml
tests:
  - name: greeting
    input: "你好"
    expect:
      contains: ["你好", "帮助"]

  - name: order-lookup
    input: "订单 #12345 的状态是什么？"
    expect:
      contains: ["订单", "状态"]
      skillCalled: order-lookup
```

### 独立 tests.yaml

```yaml
tests:
  - name: multi-turn
    conversation:
      - user: "我需要帮助"
        expect:
          contains: ["帮助"]
      - user: "我的邮箱是 alice@example.com"
        expect:
          skillCalled: account-lookup
```

## 断言

| 断言 | 描述 |
|------|------|
| `contains` | 回应包含这些子串 |
| `notContains` | 回应不包含这些子串 |
| `matches` | 回应匹配正则 |
| `skillCalled` | 调用了指定技能 |
| `workflowTriggered` | 触发了指定工作流 |
| `maxTokens` | 回应在 token 限制内 |
| `maxLatency` | 响应时间在阈值内（毫秒） |

## 运行测试

```bash
opc test                        # 运行所有测试
opc test --name greeting        # 运行指定测试
opc test --verbose              # 详细输出
opc test --format json          # JSON 输出
opc test --model gpt-4o         # 指定模型
```

## CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Agent Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx opc test --format json
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## 下一步

- [部署](/zh/guide/deployment) — 部署已测试的智能体
- [CLI 参考](/zh/api/cli) — `opc test` 参数
