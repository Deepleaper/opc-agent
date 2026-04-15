# 配置

详细配置说明请参考 [英文版](/guide/configuration)。

## 限流配置

```yaml
spec:
  rateLimits:
    perUser:
      maxRequests: 60
      windowMs: 60000
    perProvider:
      maxRequests: 100
      windowMs: 60000
```

## 缓存配置

```yaml
spec:
  cache:
    enabled: true
    ttlMs: 3600000
    maxEntries: 1000
```

## 测试配置

```yaml
spec:
  testing:
    cases:
      - name: 问候测试
        input: "你好"
        expect:
          contains: ["你好", "帮"]
          maxLatencyMs: 5000
```
