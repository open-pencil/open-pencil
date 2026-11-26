# MCP server

stdio and Hono HTTP MCP server that reuses Core tools (`packages/core/AGENTS.md`, Tools).

- MCP-only filesystem and server tools live in `packages/mcp/src/tool/registration.ts`; listener and session lifecycle under `packages/mcp/src/server/`, stdio under `packages/mcp/src/stdio/`, transport discovery under `packages/mcp/src/transport/`.
- Registration uses Standard Schema with Valibot JSON Schema conversion from the Core tool input contract; per-tool exposure comes from `isToolExposed()`.
- File access must resolve symlinks inside the effective MCP root. CLI defaults are the current directory on macOS and Linux and the home directory on Windows.
- Keep browser lifecycle out of this package and out of Core.
- Routes and socket messages check an `MCPAccessScope` through `createMCPAccess`, which answers with the SDK's OAuth challenges: the server's token (app, CLI, stdio bridge) has every scope, the client token from `mcpClientToken` only `mcp`. A new route requires a scope other than `mcp` unless MCP clients need it (`packages/mcp/tests/server/client-token.test.ts`).
- Every request to the app goes through the bridge's `sendRPC`, which applies the scope. Nothing writes a request to the app's socket around it (`packages/mcp/src/browser-rpc.ts`).
- Transport tests live under `packages/mcp/tests/{server,stdio,transport}` with their helpers in `packages/mcp/tests/helpers`; isolate tests from user runtime discovery. Playwright starts the development MCP companion through the Vite automation plugin; see `tests/AGENTS.md`.
