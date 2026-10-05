---
title: CLI Reference
description: Complete reference for all openpencil commands, options, and flags.
---

# CLI Reference

Document commands accept a `.fig` file as a positional argument. When omitted, the CLI connects to the running desktop app via RPC. `documents`, `undo`, `redo`, and `settings` always act on the running app.

## info

Show document info — pages, node counts, fonts, file size.

```sh
openpencil info [file] [--json]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

## tree

Print the node hierarchy.

```sh
openpencil tree [file] [options]
```

| Option | Description |
|--------|-------------|
| `--page` | Page name (default: first page) |
| `--depth` | Max depth (default: unlimited) |
| `--json` | Output as JSON |

## find

Search nodes by name or type.

```sh
openpencil find [file] [options]
```

| Option | Description |
|--------|-------------|
| `--name` | Node name (partial match, case-insensitive) |
| `--type` | Node type: `FRAME`, `TEXT`, `RECTANGLE`, `INSTANCE`, etc. |
| `--page` | Page name (default: all pages) |
| `--limit` | Max results (default: 100) |
| `--json` | Output as JSON |

## node

Show detailed properties of a node.

```sh
openpencil node [file] --id <id> [--json]
```

| Option | Description |
|--------|-------------|
| `--id` | **Required.** Node ID (e.g. `1:23`) |
| `--json` | Output as JSON |

## pages

List all pages in the document.

```sh
openpencil pages [file] [--json]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

## variables

List design variables and collections.

```sh
openpencil variables [file] [options]
```

| Option | Description |
|--------|-------------|
| `--collection` | Filter by collection name |
| `--type` | Filter by type: `COLOR`, `FLOAT`, `STRING`, `BOOLEAN` |
| `--json` | Output as JSON |

## tokens

Print design variables as a stylesheet of CSS custom properties. Default mode values go in `:root`; every other mode overrides them under its condition, `[data-<collection>="<mode>"]` unless the mode names a selector or `@media` query. Aliases stay `var()` references. Tokens or modes that cannot be written are listed on stderr.

```sh
openpencil tokens [file] [options]
```

| Option | Description |
|--------|-------------|
| `--format` | `css` (default), or `tailwind` for a Tailwind v4 `@theme` with a `@custom-variant` per mode |
| `--collection` | Filter by collection name |
| `--type` | Filter by type: `COLOR`, `FLOAT`, `STRING`, `BOOLEAN` |
| `--json` | Output `{ css, tokenCount, issues }` as JSON |

## export

Export to PNG, JPG, WEBP, SVG, JSX, HTML, `.fig`, or Storybook stories.

```sh
openpencil export [file] [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--format` | `-f` | `png` (default), `jpg`, `webp`, `svg`, `pdf`, `pptx`, `jsx`, `tailwind-jsx`, `html`, `fig`, `storybook` |
| `--output` | `-o` | Output file path (default: `<name>.<format>`); a directory for `storybook` (default: `<name>-stories`) |
| `--scale` | `-s` | Export scale (default: 1) |
| `--quality` | `-q` | Quality 0–100, JPG/WEBP only (default: 90) |
| `--page` | | Page name (default: first page; `fig`, `pptx`, and `storybook` default to every page) |
| `--node` | | Node ID to export (default: all top-level nodes) |
| `--style` | | JSX style: `openpencil` (default), `tailwind` (same as `-f tailwind-jsx`) |
| `--html` | | HTML mode: `fragment` (default), `standalone` |
| `--css` | | HTML CSS output: `inline` (default), `tailwind` |
| `--assets` | | Standalone HTML assets: `inline` (default), `external` |
| `--fonts` | | Standalone HTML font output: `assets`, `none` (default) |
| `--framework` | | Storybook framework: `react` (default), `vue`, `html` |
| `--design-images` | | Storybook: render a PNG per variant for the Design panel (default: on; `--no-design-images` to skip) |
| `--watch` | | Storybook: re-export whenever the document is saved |
| `--beside` | | Storybook: write each document's stories into the document's own folder; the file argument can then be several files or a quoted glob |
| `--thumbnail` | | Export page thumbnail instead of full render |
| `--width` | | Thumbnail width (default: 1920) |
| `--height` | | Thumbnail height (default: 1080) |

## import

Import HTML/CSS/Tailwind into an editable OpenPencil document.

```sh
openpencil import page.html [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--format` | `-f` | Output format: `fig` (default), `json` |
| `--output` | `-o` | Output file path (default: `<name>.<format>`) |
| `--css` | | CSS file to apply before conversion |
| `--css-text` | | Inline CSS text to apply before conversion |
| `--tailwind` | | Tailwind utility candidates to compile and apply |
| `--tailwind-file` | | File containing Tailwind utility candidates |
| `--page-name` | | Scene graph page name (default: `DOM/CSS`) |
| `--json` | | Print a machine-readable summary |

Examples:

```sh
openpencil import card.html --css card.css -o card.fig
openpencil import card.html --tailwind "flex flex-col gap-3 w-80 p-6 rounded-xl bg-white" -o card.fig
```

## eval

Execute JavaScript with the Figma Plugin API.

```sh
openpencil eval [file] [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--code` | `-c` | JavaScript code to execute |
| `--stdin` | | Read code from stdin |
| `--write` | `-w` | Write changes back to the input file |
| `--output` | `-o` | Write to a different file |
| `--json` | | Output as JSON |
| `--quiet` | `-q` | Suppress output |

## analyze colors

Analyze color palette usage across the document.

```sh
openpencil analyze colors [file] [options]
```

| Option | Description |
|--------|-------------|
| `--limit` | Max colors to show (default: 30) |
| `--threshold` | Distance threshold for clustering similar colors, 0–50 (default: 15) |
| `--similar` | Show similar color clusters |
| `--json` | Output as JSON |

## analyze typography

Analyze font family, size, and weight distribution.

```sh
openpencil analyze typography [file] [options]
```

| Option | Description |
|--------|-------------|
| `--group-by` | Group by: `family`, `size`, `weight` (default: show all styles) |
| `--limit` | Max styles to show (default: 30) |
| `--json` | Output as JSON |

## analyze spacing

Analyze gap and padding values across auto-layout frames.

```sh
openpencil analyze spacing [file] [options]
```

| Option | Description |
|--------|-------------|
| `--grid` | Base grid size to check against (default: 8) |
| `--json` | Output as JSON |

## analyze clusters

Find repeated node patterns — potential components.

```sh
openpencil analyze clusters [file] [options]
```

| Option | Description |
|--------|-------------|
| `--limit` | Max clusters to show (default: 20) |
| `--min-size` | Min node size in px (default: 30) |
| `--min-count` | Min instances to form a cluster (default: 2) |
| `--json` | Output as JSON |

## diff create

Patch that turns one node tree into another, as JSX attribute changes plus moved, added, and removed children. Children match by name; see [Comparing designs](/programmable/cli/comparing) for the format.

```sh
openpencil diff create [file] --from <id> --to <id> [options]
```

| Option | Description |
|--------|-------------|
| `--from` | Source node ID |
| `--to` | Target node ID |
| `--depth` | Max tree depth (default: 10) |
| `--json` | Output as JSON |

## diff jsx

Structural diff between two nodes as design JSX.

```sh
openpencil diff jsx [file] --from <id> --to <id> [--json]
```

## diff show

Preview the patch that setting JSX attributes on a node would produce, without changing it.

```sh
openpencil diff show <id> [file] --attributes '<jsx attributes>' [--json]
```

`--attributes` takes attributes as the JSX export writes them, such as `'w={200} bg="#FF0000"'`.

## diff apply

Apply a patch from `diff create`, `diff show`, or `diff files`. Every node must still match the patch's old values unless `--force` is set, and nothing changes unless every hunk applies.

```sh
openpencil diff apply <patch> [file] [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--dry-run` | | Validate and list changes without applying |
| `--force` | | Apply even when current values differ from the patch |
| `--write` | `-w` | Write changes back to the input file |
| `--output` | `-o` | Write to a different file |
| `--json` | | Output as JSON |

Pass `-` as the patch path to read it from stdin.

## diff visual

Pixel diff between two rendered nodes, written as a PNG with changed pixels in red.

```sh
openpencil diff visual [file] --from <id> --to <id> --output <png> [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--output` | `-o` | Diff PNG path |
| `--scale` | | Render scale before the max-edge limit (default: 1) |
| `--max-edge` | | Maximum image width or height (default: 1280) |
| `--threshold` | | Color tolerance 0–1; smaller is stricter (default: 0.1) |
| `--json` | | Output as JSON |

## diff files

Structural diff of two documents, page by page. Pages match by name and nodes by name path, so two versions of a file compare even though their node IDs differ. Exits with status 1 when the documents differ and 2 when the options are invalid, such as a `--page` neither document has.

```sh
openpencil diff files <before> <after> [options]
```

| Option | Description |
|--------|-------------|
| `--page` | Compare only the page with this name |
| `--depth` | Max tree depth below each page (default: unlimited) |
| `--json` | Output as JSON |

## documents

Manage documents (tabs) in the running app. See [Controlling the App](/programmable/cli/app-control).

```sh
openpencil documents list [--json]
openpencil documents open <file> [--json]
openpencil documents new [--path <file>] [--json]
openpencil documents save [--path <file>] [--document-id <id>] [--json]
openpencil documents close [--save | --discard] [--path <file>] [--document-id <id>] [--json]
openpencil documents activate <document-id> [--page-id <id>] [--json]
```

| Option | Description |
|--------|-------------|
| `--path` | `.fig` path to create or save to; relative to the current directory |
| `--save` | `close`: save unsaved changes first |
| `--discard` | `close`: close without saving; unsaved changes are lost |
| `--document-id` | Target document; defaults to the active tab |
| `--page-id` | Page to switch the activated document to |
| `--json` | Output the result and target document as JSON |

## undo / redo

Undo or redo the newest change made through the CLI or MCP in the running app. Fails when the newest change was made in the editor; see [Controlling the App](/programmable/cli/app-control#undo-and-redo).

```sh
openpencil undo [--document-id <id>] [--json]
openpencil redo [--document-id <id>] [--json]
```

## settings

Read and change editor settings in the running app by dotted key. Values parse as JSON, falling back to plain strings.

```sh
openpencil settings get [key] [--json]
openpencil settings set <key> <value> [--json]
```

See [Controlling the App](/programmable/cli/app-control#settings) for the available keys.

## tool

List, describe, and call the editor tools that the MCP server exposes.

```sh
openpencil tool list [--json]
openpencil tool describe <name> [--json]
openpencil tool call <name> [file] [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--args` | | Tool arguments as a JSON object |
| `--args-file` | | Read arguments from a JSON file, or `-` for stdin |
| `--write` | `-w` | Headless: write changes back to the input file |
| `--output` | `-o` | Headless: write changes to a different file |
| `--document-id` | | App: target document |
| `--page-id` | | App: target page |
| `--json` | | Output as JSON |
