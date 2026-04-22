# Task: Fix remaining voice test failures

## Problem
tests/voice.test.ts and tests/voice-enhanced.test.ts use VoiceChannel API but VoiceProcessor has different method names.

Run `npx vitest run tests/voice.test.ts tests/voice-enhanced.test.ts` to see failures.

## Fix approach
Update the TEST FILES (not source) to use VoiceProcessor's actual API:
1. Read src/channels/voice.ts to see what methods VoiceProcessor actually has
2. Update tests to match the actual API

Also fix:
- tests/settings-api.test.ts: Read dist/studio/index.html, update test assertions to match actual HTML
- tests/cli.test.ts: Read dist/cli.js, update test assertions to match actual strings  
- tests/a2a.test.ts: check why "should send A2A request and get response" fails
- tests/init-role.test.ts: check if agent.yaml changed format
- tests/mcp-servers.test.ts: check if playground page id changed

## Goal
`npx vitest run` = 0 failures

## Constraints
- Only modify test files (tests/)
- Can also add backward-compat aliases to src/channels/voice.ts if needed
- npx tsc must pass
- git commit when done
