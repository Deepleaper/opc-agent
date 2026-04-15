# Contributing to OPC Agent

Thank you for your interest in contributing to OPC Agent! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/opc-agent.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/my-feature`

## Development

```bash
# Build
npm run build

# Run tests
npm test

# Type check
npm run lint

# Watch mode
npm run dev
```

## Project Structure

```
src/
├── core/          # Agent, Runtime, Config, Logger, Types
├── channels/      # Web, WebSocket, Telegram channels
├── memory/        # InMemoryStore, DeepBrainMemoryStore
├── providers/     # LLM provider abstraction
├── schema/        # OAD schema (Zod)
├── skills/        # BaseSkill, SkillRegistry
├── templates/     # Agent templates
├── dtv/           # Data, Trust, Value framework
├── cli.ts         # CLI entry point
└── index.ts       # Public API exports
```

## Guidelines

- **TypeScript**: All code must be TypeScript with strict mode
- **Tests**: Add tests for new features in `tests/`
- **Commits**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **OAD Compatibility**: Changes to OAD schema must be backward-compatible
- **No Breaking Changes** without major version bump

## Adding a Template

1. Create `src/templates/my-template.ts` with config factory function
2. Create `templates/my-template/oad.yaml` and `README.md`
3. Register in `src/cli.ts` TEMPLATES map
4. Add tests

## Adding a Channel

1. Create `src/channels/my-channel.ts` extending `BaseChannel`
2. Add channel type to OAD schema in `src/schema/oad.ts`
3. Wire up in `src/core/runtime.ts`
4. Export from `src/index.ts`

## Pull Requests

1. Ensure all tests pass: `npm test`
2. Ensure types check: `npm run lint`
3. Write a clear PR description
4. Reference any related issues

## License

By contributing, you agree that your contributions will be licensed under Apache-2.0.
