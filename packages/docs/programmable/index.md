---
layout: doc
title: Automation
description: AI chat, CLI, JSX renderer, MCP server, and other automation surfaces built on the Inkly editor engine.
---

# Automation

Inkly treats design files as data. Every operation available in the editor — creating shapes, setting fills, managing auto-layout, exporting assets — is also available from the terminal, from AI agents, and from code. No plugins to install, no API keys, no waiting list.

The editor UI and the automation interfaces use the same engine. If you can do it by clicking, you can do it by scripting.

## The bigger idea

Inkly is not just meant to be a design app.

It is also meant to be a toolkit: something you can embed into other products, wrap with your own UI, and use to build editing workflows that fit your own domain.

That is why the automation surface matters. The app, the CLI, the AI tools, the JSX renderer, the MCP server, and the SDK all build on the same underlying editor engine.

## AI Chat

The built-in assistant has access to 87 tools that cover the full surface of the editor. Describe what you want in natural language — "add a 16px drop shadow to all buttons", "create a card component with dark mode variant", "export every frame on this page at 2×".

[AI Chat →](./ai-chat)

## Collaboration

Real-time multiplayer editing over peer-to-peer WebRTC. No server, no account. Share a room link and edit together with live cursors and follow mode. Document state syncs via CRDT, so edits merge automatically even on flaky connections.

[Collaboration →](./collaboration)

## Vue SDK

Build Inkly-powered editors with the same Vue SDK the app uses internally. The SDK exposes editor context, canvas wiring, selection state, command models, property-panel composables, and headless primitives.

[Vue SDK →](./sdk/)

## JSX Renderer

Describe UI as JSX — the same syntax LLMs already know from React. A single call can create an entire component tree with frames, text, auto-layout, fills, and strokes. Compact, declarative, and diffable.

Going the other direction, export any selection back to JSX with Tailwind classes — useful for handing off to development or feeding designs back into an LLM.

[JSX Renderer →](./jsx-renderer)

## CLI

Inspect, lint, export, and analyze design documents without opening the editor. List pages, search nodes, extract design tokens, catch layout or accessibility issues, and render to PNG — all from the terminal with machine-readable JSON output.

The CLI also connects to the running desktop app via RPC, so you can script the editor while you're using it.

[Inspecting Files](./cli/inspecting) · [Exporting](./cli/exporting) · [Analyzing Designs](./cli/analyzing) · [Scripting](./cli/scripting)

## MCP Server

Connect Claude Code, Cursor, Windsurf, or any MCP-compatible client to Inkly. The server exposes 90 tools for reading, creating, and modifying designs — the same tools the built-in AI chat uses. Runs over stdio or HTTP with session support.

[MCP Server →](./mcp-server)

## Why Open?

Figma is a closed platform. Their MCP server is read-only. CDP browser access was killed in version 126. Design files live in a proprietary format on someone else's servers. Plugin development requires a custom runtime with limited APIs.

Inkly is the alternative: open source, MIT licensed, every operation scriptable, data stored locally. Your design files are yours — inspect them, transform them, pipe them into CI, feed them to an LLM. No permission needed.
