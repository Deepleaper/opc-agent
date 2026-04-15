# Testing

## Overview

OPC Agent includes a built-in testing framework. Define test cases in your `oad.yaml` or a separate `tests.yaml` file, then run them with `opc test`.

## Defining Tests in OAD

```yaml
spec:
  testing:
    cases:
      - name: greeting
        input: "Hello!"
        expect:
          contains: ["hello", "help"]
          maxLatencyMs: 5000
      
      - name: product-question
        input: "What are your pricing plans?"
        expect:
          contains: ["pricing", "plan"]
          notContains: ["error"]
      
      - name: edge-case-empty
        input: ""
        expect:
          maxLatencyMs: 2000
```

## Separate Test File

Create `tests.yaml` alongside your `oad.yaml`:

```yaml
cases:
  - name: smoke-test
    input: "Hi there"
    expect:
      maxLatencyMs: 10000
  - name: faq-check
    input: "What is your return policy?"
    expect:
      contains: ["return", "refund"]
```

## Running Tests

```bash
# Run tests
opc test

# JSON output
opc test --json

# Custom OAD file
opc test -f my-agent.yaml
```

## Test Report

```
═══════════════════════════════════════════
  OPC Agent Test Report
═══════════════════════════════════════════

  ✔ [PASS] greeting (245ms)
  ✔ [PASS] product-question (312ms)
  ✘ [FAIL] edge-case (5120ms)
      → Latency 5120ms exceeded max 2000ms

───────────────────────────────────────────
  Total: 3  Passed: 2  Failed: 1  Duration: 5677ms
───────────────────────────────────────────
```

## Assertions

| Assertion | Description |
|-----------|-------------|
| `contains` | Response must include these strings (case-insensitive) |
| `notContains` | Response must NOT include these strings |
| `toolCalled` | Specified tools must have been invoked |
| `maxLatencyMs` | Response must complete within this time |
