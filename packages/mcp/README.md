# @open-pencil/mcp

Model Context Protocol server for [OpenPencil](https://openpencil.dev). It lets MCP clients such as Claude Code, Cursor, and Windsurf inspect and edit designs through the running app, reusing the same tool definitions as the built-in AI chat.

```sh
npm install -g @open-pencil/mcp
openpencil-mcp        # stdio transport for MCP clients
openpencil-mcp-http   # Streamable HTTP transport for browser extensions and scripts
```

On macOS and Linux, local clients prefer a private Unix domain socket; Windows and unavailable sockets fall back to localhost TCP. File access is limited to the effective MCP root.

- Setup and client configuration: https://openpencil.dev/programmable/mcp-server
- Source and issues: https://github.com/open-pencil/open-pencil

MIT License.
