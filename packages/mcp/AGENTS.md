# MCP (`packages/mcp`)

MCP server for AI coding tools. Stdio + HTTP (Hono). Reuses core tools.

- MCP-only tools such as `open_file`, `new_document`, `save_file`, and `get_codegen_prompt` are registered in `tool/registration.ts` because they need server filesystem access or are not scene-graph tools. Listener lifecycle and session ownership live under `src/server/`; the stdio client bridge lives under `src/stdio/`.
- Local MCP transport discovery lives under `packages/mcp/src/transport/`: macOS/Linux prefer an owner-only Unix socket, Windows uses localhost TCP, and `mcp.json` advertises the active transport and token. Keep transport tests grouped under `tests/engine/mcp/{server,stdio,transport}/`, shared MCP fixtures under `tests/helpers/mcp/`, and test discovery paths isolated from the user's runtime file.
- `open_file` and `new_document` are only registered when `OPENPENCIL_MCP_ROOT` is set. Export tools can write files under that root when given a `path`; path checks must resolve symlinks before filesystem access.
