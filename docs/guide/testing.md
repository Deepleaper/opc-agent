# Testing

## Overview

OPC Agent includes a built-in testing framework. Define test cases in your `oad.yaml` or a separate `tests.yaml` file, then run them with `opc test`.

## Quick Start

```bash
opc test
```

## Defining Tests

### In oad.yaml

```yaml
tests:
  - name: greeting
    input: "Hello"
    expect:
      contains: ["hello", "help"]

  - name: order-lookup
    input: "What's the status of order #12345?"
    expect:
      contains: ["order", "status"]
      skillCalled: order-lookup

  - name: refund-request
    input: "I want a refund for my last purchase"
    expect:
      workflowTriggered: refund-process
      notContains: ["I can't", "unable"]
```

### Separate tests.yaml

```yaml
# tests.yaml
tests:
  - name: multi-turn-conversation
    conversation:
      - user: "I need help with my account"
        expect:
          contains: ["account"]
      - user: "My email is alice@example.com"
        expect:
          skillCalled: account-lookup
      - user: "Reset my password"
        expect:
          workflowTriggered: password-reset
```

## Assertions

| Assertion | Description |
|-----------|-------------|
| `contains` | Response includes these substrings |
| `notContains` | Response does NOT include these substrings |
| `matches` | Response matches regex pattern |
| `skillCalled` | Specified skill was invoked |
| `workflowTriggered` | Specified workflow was triggered |
| `maxTokens` | Response is within token limit |
| `maxLatency` | Response time is under threshold (ms) |

## Running Tests

```bash
# Run all tests
opc test

# Run specific test
opc test --name greeting

# Run with verbose output
opc test --verbose

# Output as JSON
opc test --format json

# Run against a specific model
opc test --model gpt-4o
```

## CI/CD Integration

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

## Next Steps

- [Deployment](/guide/deployment) — Deploy your tested agent
- [CLI Reference](/api/cli) — `opc test` flags
