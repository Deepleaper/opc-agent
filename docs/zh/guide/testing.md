# 测试

## 概览

OPC Agent 内置了测试框架。你可以在 `oad.yaml` 或单独的 `tests.yaml` 中定义测试用例，用 `opc test` 一键运行。

## 在 OAD 中定义测试

```yaml
spec:
  testing:
    cases:
      - name: 问候测试
        input: "你好！"
        expect:
          contains: ["你好", "帮"]
          maxLatencyMs: 5000

      - name: 产品咨询
        input: "你们怎么收费？"
        expect:
          contains: ["价格", "套餐"]
          notContains: ["error"]

      - name: 空输入
        input: ""
        expect:
          maxLatencyMs: 2000
```

## 独立测试文件

在 `oad.yaml` 同目录创建 `tests.yaml`：

```yaml
cases:
  - name: 冒烟测试
    input: "你好"
    expect:
      maxLatencyMs: 10000

  - name: FAQ 验证
    input: "退货政策是什么？"
    expect:
      contains: ["退货", "退款"]
```

## 运行测试

```bash
# 运行测试
opc test

# JSON 格式输出
opc test --json

# 指定 OAD 文件
opc test -f my-agent.yaml

# 监听模式（改了代码自动重跑）
opc test --watch
```

## 测试报告

```
═══════════════════════════════════════════
  OPC Agent 测试报告
═══════════════════════════════════════════

  ✔ [通过] 问候测试 (245ms)
  ✔ [通过] 产品咨询 (312ms)
  ✘ [失败] 空输入 (5120ms)
      → 延迟 5120ms 超过上限 2000ms

───────────────────────────────────────────
  总计: 3  通过: 2  失败: 1  耗时: 5677ms
───────────────────────────────────────────
```

## 断言类型

| 断言 | 说明 |
|------|------|
| `contains` | 回复必须包含这些字符串（不区分大小写） |
| `notContains` | 回复不能包含这些字符串 |
| `toolCalled` | 指定的工具必须被调用 |
| `maxLatencyMs` | 响应必须在指定时间内完成 |
