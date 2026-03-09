---
title: Scripting
description: Execute JavaScript with the Figma Plugin API — query nodes, batch-modify designs, create frames.
---

# Scripting

`open-pencil eval` gives you the full Figma Plugin API in the terminal. Read nodes, modify properties, create shapes — then write changes back to the file.

## Basic Usage

```sh
open-pencil eval design.fig -c "figma.currentPage.children.length"
```

The `-c` flag takes JavaScript. The `figma` global works like the Figma Plugin API.

## Query Nodes

```sh
open-pencil eval design.fig -c "
  figma.currentPage.findAll(n => n.type === 'FRAME' && n.name.includes('Button'))
    .map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
"
```

## Modify and Save

```sh
open-pencil eval design.fig -c "
  figma.currentPage.children.forEach(n => n.opacity = 0.5)
" -w
```

`-w` writes changes back to the input file. Use `-o output.fig` to write to a different file instead.

## Read from Stdin

For longer scripts:

```sh
cat transform.js | open-pencil eval design.fig --stdin -w
```

## Live App Mode

Omit the file to run against the running desktop app:

```sh
open-pencil eval -c "figma.currentPage.name"
```

## Available API

The `figma` object supports:

- `figma.currentPage` — the active page
- `figma.root` — the document root
- `figma.createFrame()`, `figma.createRectangle()`, `figma.createEllipse()`, `figma.createText()`, etc.
- `.findAll()`, `.findOne()` — search descendants
- `.appendChild()`, `.insertChild()` — tree manipulation
- All property setters: `.fills`, `.strokes`, `.effects`, `.opacity`, `.cornerRadius`, `.layoutMode`, `.itemSpacing`, etc.

This is the same API Figma plugins use, so existing knowledge and code snippets transfer directly.

## JSON Output

```sh
open-pencil eval design.fig -c "..." --json
```
