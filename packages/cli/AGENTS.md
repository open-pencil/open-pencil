# CLI

Headless `.fig` inspection, export, linting, and scripting with `citty`. `bun open-pencil --help` lists current commands.

- Format all output with the `agentfmt` helpers re-exported from `packages/cli/src/format.ts`; do not hand-roll terminal formatting.
- Data and inspection commands support `--json`.
- A command that works on one page spreads `pageOptions` from `packages/cli/src/app/target.ts` and resolves `--page`/`--page-id` through `requestedPage` (file) or `appPageTargetRPCArgs` (app), never its own page flags; `packages/cli/tests/commands/page-options.test.ts`.
- App-only commands (`documents`, `undo`, `redo`, `settings`) print through `runAppCommand` in `packages/cli/src/app/command.ts`; `tool` lists and calls the same MCP-exposed Core tools as the app bridge, so add operations as tools rather than new RPC commands where they act on a document.
- Commands own their CLI UX independently of tools; `eval` exposes operations through `FigmaAPI` (`packages/core/AGENTS.md`, Figma API). Keep the public docs under `packages/docs/developers/cli/` and the skill examples current when commands change.
- The MCP `--root` default is the current directory on macOS and Linux and the home directory on Windows; see `packages/mcp/AGENTS.md`.
