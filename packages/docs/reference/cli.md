---
title: CLI Reference
description: Complete reference for all openpencil commands, options, and flags.
---

# CLI Reference

All commands accept a `.fig` file as a positional argument. When omitted, the CLI connects to the running desktop app via RPC.

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

## export

Export to PNG, JPG, WEBP, SVG, or JSX.

```sh
openpencil export [file] [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--format` | `-f` | `png` (default), `jpg`, `webp`, `svg`, `jsx` |
| `--output` | `-o` | Output file path (default: `<name>.<format>`) |
| `--scale` | `-s` | Export scale (default: 1) |
| `--quality` | `-q` | Quality 0–100, JPG/WEBP only (default: 90) |
| `--page` | | Page name (default: first page) |
| `--node` | | Node ID to export (default: all top-level nodes) |
| `--style` | | JSX style: `openpencil` (default), `tailwind` |
| `--thumbnail` | | Export page thumbnail instead of full render |
| `--width` | | Thumbnail width (default: 1920) |
| `--height` | | Thumbnail height (default: 1080) |

## dom

Convert HTML/CSS/Tailwind into an editable OpenPencil document.

```sh
openpencil dom page.html [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--format` | `-f` | Output format: `fig` (default), `html`, `json` |
| `--output` | `-o` | Output file path (default: `<name>.<format>`) |
| `--css` | | CSS file to apply before conversion |
| `--css-text` | | Inline CSS text to apply before conversion |
| `--tailwind` | | Tailwind utility candidates to compile and apply |
| `--tailwind-file` | | File containing Tailwind utility candidates |
| `--page-name` | | Scene graph page name (default: `DOM/CSS`) |
| `--json` | | Print a machine-readable summary |

Examples:

```sh
openpencil dom card.html --css card.css -o card.fig
openpencil dom card.html --tailwind "flex flex-col gap-3 w-80 p-6 rounded-xl bg-white" -o card.fig
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
