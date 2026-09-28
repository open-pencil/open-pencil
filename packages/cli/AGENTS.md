# CLI

Headless `.fig` inspection, export, linting, and scripting with `citty`. `bun open-pencil --help` lists current commands.

- Format all output with the `agentfmt` helpers re-exported from `packages/cli/src/format.ts`; do not hand-roll terminal formatting.
- Data and inspection commands support `--json`.
- Commands own their CLI UX independently of tools; `eval` exposes operations through `FigmaAPI` (`packages/core/AGENTS.md`, Figma API). Keep the public docs under `packages/docs/programmable/cli/` and the skill examples current when commands change.
- The MCP `--root` default is the current directory on macOS and Linux and the home directory on Windows; see `packages/mcp/AGENTS.md`.
