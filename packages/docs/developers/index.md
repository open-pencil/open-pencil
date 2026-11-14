---
layout: doc
title: Developers
description: Script design files from the terminal, let an AI agent drive the editor, or build your own editor on the OpenPencil engine.
---

# Developers

Everything the editor does is available outside it: from the terminal, to AI agents, and from code. All of it runs on the same engine as the app, so if you can do it by clicking, you can do it by script. Pick the tool for what you want to build.

## Script design files

The `openpencil` CLI reads, checks, exports, and edits `.fig` and `.pen` files without opening the app, and prints JSON for scripts and CI. While the desktop app runs, the same CLI drives it: open and save documents, undo, change settings, and call any editor tool.

<SdkCardGroup>
  <SdkCard title="Command reference" to="/reference/cli" description="Every command and its options." />
  <SdkCard title="Inspecting files" to="/developers/cli/inspecting" description="Pages, nodes, XPath queries, and design tokens." />
  <SdkCard title="Exporting" to="/developers/cli/exporting" description="Images, JSX, HTML, design tokens, and Storybook stories." />
  <SdkCard title="Scripting" to="/developers/cli/scripting" description="The Figma Plugin API and an openpencil API through eval." />
</SdkCardGroup>

## Let an AI agent design

The MCP server gives Claude Code, Cursor, Windsurf, or any MCP client the 90 tools the built-in assistant uses, so an agent can read, create, and change designs. Agents describe UI as JSX, which creates real frames, text, and auto layout.

<SdkCardGroup>
  <SdkCard title="MCP server" to="/developers/mcp-server" description="Connect a client over stdio or HTTP." />
  <SdkCard title="JSX renderer" to="/developers/jsx-renderer" description="Create component trees from JSX, and export a selection back to it." />
  <SdkCard title="Design authoring reference" to="/reference/design-authoring" description="What design JSX accepts." />
</SdkCardGroup>

To use an agent inside the app instead, see [AI Chat](../user-guide/ai-chat) and [Coding agents](../user-guide/coding-agents).

## Build your own editor

`@open-pencil/vue` is the Vue SDK the app is built with: editor context, the canvas, selection, commands, and headless panels you style yourself. The engine's own libraries work without Vue, in the browser or on a server.

<SdkCardGroup>
  <SdkCard title="Vue SDK" to="/developers/sdk/" description="Embed the editor or build a focused one." />
  <SdkCard title="Native JavaScript APIs" to="/developers/native-api" description="The engine's libraries, without the UI." />
  <SdkCard title="URL scheme" to="/developers/url-scheme" description="Link a page straight to a layer in the app." />
</SdkCardGroup>

## Look inside

<SdkCardGroup>
  <SdkCard title="Reference" to="/reference/node-types" description="Node types, the scene graph, the DOM/CSS mapping, and the file format." />
  <SdkCard title="Contributing" to="/development/contributing" description="Build the app, run the tests, and send a change." />
</SdkCardGroup>
