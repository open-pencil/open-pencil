---
title: Controlling the App
description: Open, save, switch, and close documents, undo and redo, change settings, and call any editor tool in the running app from the CLI.
---

# Controlling the App

While the desktop app is running, the CLI drives it over the same automation bridge as the [MCP server](/programmable/mcp-server). Every command on this page except headless `tool call` needs the running app.

## Documents

Each open tab is a document with a stable ID. List them, then pass `--document-id` (and `--page-id`) to aim a command at a background tab without switching to it:

```sh
openpencil documents list --json
openpencil tree --document-id tab-123 --page-id 0:1
```

Open, create, save, and close documents:

```sh
openpencil documents open designs/landing.fig      # opens in a new tab
openpencil documents new --path designs/draft.fig  # empty document, saved to the path
openpencil documents save --document-id tab-123
openpencil documents save --document-id tab-123 --path designs/copy.fig
openpencil documents close --document-id tab-123
openpencil documents close --document-id tab-123 --save      # or --discard
```

Relative paths resolve against the shell's working directory. These commands never open a dialog in the app, because nobody may be there to answer it. Closing a document with unsaved changes fails unless you pass `--save` or `--discard`, and saving a document that has never been saved needs `--path`. Each command prints the document and page it acted on; with `--json` it prints `{ "result", "target" }`, so a script can read the new document's ID from `target.documentId`.

To bring a tab to the front, optionally on a specific page:

```sh
openpencil documents activate tab-123 --page-id 0:4
```

## Undo and redo

Step back through changes made through the CLI and MCP, like **Edit → Undo** and **Edit → Redo**:

```sh
openpencil undo --document-id tab-123
openpencil redo --document-id tab-123 --json
```

```json
{
  "result": { "applied": true, "label": "Set opacity", "scope": "document" },
  "target": { "documentId": "tab-123", "documentName": "Landing", "pageId": "0:1", "pageName": "Page 1" }
}
```

When there is nothing to undo or redo, the command says so and `result.applied` is `false`.

The editor has one history, shared by you and every automation client, so **Edit → Undo** in the app steps back through any change, newest first. Automation is narrower: `undo` and `redo` only act on a step that the CLI or MCP made, and only while it is the newest one. If the newest change was made in the editor, the command fails and leaves it alone, so an agent can't revert your work. They also fail while the document is in vector edit mode, whose history belongs to the editing session.

Each CLI or MCP command that edits the document is one undo step. An `eval` script is recorded against its target page: if it switches `figma.currentPage` and edits another page, those edits are not part of the undo step.

## Settings

Read and change editor settings by dotted key:

```sh
openpencil settings get
openpencil settings get appearance.theme
openpencil settings set appearance.theme light
openpencil settings set editing.snapping.pixelGrid false
openpencil settings set chat.maxAgentSteps 100
```

Values are read as JSON when they parse (`false`, `100`, `"auto"`) and as plain strings otherwise. Invalid keys and values are rejected without changing anything.

| Key | Values |
|-----|--------|
| `appearance.theme` | `dark`, `light`, `auto` |
| `appearance.language` | `en`, `de`, `es`, `fr`, `it`, `ja`, `pl`, `ru`, `zh-CN` |
| `appearance.animations` | `system`, `off` |
| `editing.snapping.geometry` | `true`, `false` |
| `editing.snapping.objects` | `true`, `false` |
| `editing.snapping.pixelGrid` | `true`, `false` |
| `rendering.canvasMode` | `retained`, `tiled` (applies after a reload) |
| `recovery.enabled` | `true`, `false` |
| `chat.reasoningDisplay` | `collapsed`, `while-thinking`, `expanded` |
| `chat.maxAgentSteps` | integer 1–1000 |
| `chat.changePreviewSize` | `off`, `small`, `medium`, `large` |
| `designCheck.showOnCanvas` | `true`, `false` |
| `designCheck.preset` | `recommended`, `strict`, `accessibility` |
| `designCheck.disabledRules` | JSON array of rule IDs, e.g. `["no-default-names"]`; see `openpencil lint --list-rules` |

Credentials, AI models, MCP connections, storage, and tool access are deliberately not available here: an automation client can't read secrets or grant itself access.

## Calling tools

Every editor tool the MCP server exposes is also available from the CLI. List them, inspect a tool's arguments as JSON Schema, and call it with a JSON object:

```sh
openpencil tool list
openpencil tool describe set_fill
openpencil tool call set_fill --args '{"id":"0:5","color":"#2563eb"}'
openpencil tool call set_fill --document-id tab-123 --args-file fill.json
echo '{"name":"Icons"}' | openpencil tool call create_page --args-file -
```

Pass a file to run a tool headlessly instead. Changes to a file are kept only with `--write` (back to the input) or `--output`:

```sh
openpencil tool call create_page design.fig --args '{"name":"Icons"}' --write
openpencil tool call get_page_tree design.fig --json
```

For multi-step edits, [`eval`](./scripting) runs a whole script against the same Figma-compatible API.
