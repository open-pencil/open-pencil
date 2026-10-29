# @open-pencil/mcp

Model Context Protocol server for [OpenPencil](https://openpencil.dev). It lets MCP clients such as Claude Code, Cursor, and Windsurf inspect and edit designs through the running app, reusing the same tool definitions as the built-in AI chat.

```sh
npm install -g @open-pencil/mcp
openpencil-mcp        # stdio transport for MCP clients
openpencil-mcp-http   # Streamable HTTP transport for browser extensions and scripts
```

On macOS and Linux, local clients prefer a private Unix domain socket; Windows and unavailable sockets fall back to localhost TCP. File access is limited to the effective MCP root.

Streamable HTTP clients initialize with a POST, then open GET/SSE with the returned `Mcp-Session-Id`; DELETE ends the session. The server keeps at most 10 sessions and closes those idle for 15 minutes (`OPENPENCIL_MCP_SESSION_IDLE_TIMEOUT_MS`, `0` disables). Running requests keep a session alive, an open SSE stream alone does not, and an expired session ID returns 404.

- Setup and client configuration: https://openpencil.dev/programmable/mcp-server
- Source and issues: https://github.com/open-pencil/open-pencil

MIT License.
