# CLI (`packages/cli`)

Headless CLI for .fig inspection, export, linting. Uses `citty` + `agentfmt`.

- All CLI output must use `agentfmt` formatters — `fmtList`, `fmtHistogram`, `fmtSummary`, `fmtNode`, `fmtTree`, `kv`, `entity`, `bold`, `dim`, etc.
- Don't hand-roll `console.log` formatting — use the helpers from `packages/cli/src/format.ts` which re-exports agentfmt with project-specific adapters (`nodeToData`, `nodeDetails`, `nodeToTreeNode`, `nodeToListItem`)
- CLI data/inspection commands should support `--json` for machine-readable output
- CLI commands in `packages/cli/src/commands/**` are not generated from ToolDefs; they own CLI UX, pagination, and agentfmt formatting. The `eval` command exposes ToolDef operations through `FigmaAPI`.
- CLI publishes a Node-compatible `bin/openpencil.js` wrapper; do not point package `bin` entries at TypeScript source
