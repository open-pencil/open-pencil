---
pageClass: guide
title: Coming from pen.dev
description: Open pen.dev (formerly Pencil) files in OpenPencil, see what comes along, and keep designing with an AI agent.
---

# Coming from pen.dev

OpenPencil opens the `.pen` files of pen.dev, formerly called Pencil. Your design comes in as layers you can edit, and you keep working with the AI agent you already use.

## Open a `.pen` File

Press <Keys mac="⌘ O" other="Ctrl O" /> and choose the file, or drag it onto the window. On your computer, you can also open it from Finder or File Explorer with the desktop app.

OpenPencil reads `.pen` files but doesn't write them. The first time you save, it asks where to put a new `.fig` file, named like the original; a browser without a save dialog downloads it instead. The `.pen` file stays as it was, and the `.fig` file opens in Figma too.

## What Comes Along

- Frames, shapes, and paths, with their fills, strokes, and effects.
- Text, and layout: rows, columns, gaps, and padding.
- Components and their instances, with the changes made to each instance.
- Themes, as collections of [variables](./variables). Theme options that your variables combine, such as color mode and density, share a collection whose modes are their combinations; an option on its own gets a collection of its own.
- Icons and images.

Some things don't come along yet:

- Layers from other files the document imports.
- Script, browser, shader, note, and context layers.
- In the browser, images saved next to the file. Open the file in the desktop app to keep them.

## Keep Working With an AI Agent

The agent you design with in pen.dev can work in OpenPencil too:

- In the desktop app, use [Claude Code, Codex, Cursor, or another coding agent](./coding-agents) you already have as the AI chat.
- Or connect your agent to OpenPencil's [MCP server](/developers/mcp-server) from its own terminal or editor, and it edits the open document.

Agents edit the document while it's open, so they don't need a `.pen` file on disk.
