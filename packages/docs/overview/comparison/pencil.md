---
title: OpenPencil vs Pencil
description: How OpenPencil, an open-source design editor, and Pencil (pen.dev), a proprietary AI design tool, differ in licensing, file formats, AI, collaboration, and price.
---

# OpenPencil vs Pencil

[Pencil](https://pen.dev) is a commercial AI design tool that keeps designs in `.pen` files and works alongside coding agents. OpenPencil is an open-source design editor that opens those `.pen` files as well as Figma's `.fig` files. The two are separate projects from different teams. This page compares them as of Pencil desktop 1.2 and OpenPencil 0.17.

## At a Glance

|                    | OpenPencil                                                                                 | Pencil                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| License            | Open source: MIT (editor), Apache 2.0 (Cloud server)                                       | Proprietary                                                                  |
| Price              | Free; Cloud plans add storage, editors, and AI credits                                     | Free plan with limited AI; Pro and Ultra plans per user                      |
| Where it runs      | Desktop app for macOS, Windows, and Linux, and the browser                                 | Desktop app, code editor extension, and the browser                          |
| Native format      | Figma `.fig`                                                                               | `.pen`                                                                       |
| Opens `.pen` files | Yes                                                                                        | Yes                                                                          |
| Opens `.fig` files | Opens and saves them                                                                       | Imports them                                                                 |
| Built-in AI        | Chat assistant with 100+ design tools; your own provider keys or Cloud credits             | On-canvas agents; your own keys, a ChatGPT or Claude subscription, or plans  |
| Coding agents      | MCP server, plus Claude Code, Codex, Cursor, and others running inside the editor          | MCP server for Claude Code, Codex, Cursor, and others                        |
| Scripting          | Headless CLI and Figma Plugin API–compatible scripting                                     | CLI                                                                          |
| Code export        | Design JSX, HTML, Vue, and React with CSS or Tailwind                                      | HTML with CSS or Tailwind                                                    |
| Collaboration      | Real-time editing in peer-to-peer rooms or on OpenPencil Cloud, with comments and history  | Share links, live shares, comments, and versions                             |
| Self-hosting       | OpenPencil Cloud server                                                                    | —                                                                            |

## License and Files

Pencil is licensed, not sold: its terms forbid modifying or redistributing the app. OpenPencil's editor is MIT-licensed and its Cloud server is Apache 2.0, so you can read, change, and host all of it.

OpenPencil saves in Figma's `.fig` format, which Figma and other tools open too. It opens `.pen` documents, so a Pencil project can be brought over and saved as `.fig`; see [Exporting](/user-guide/exporting) for opening files.

## AI

Both editors are built for working with AI. Pencil runs several agents on the canvas at once, generates images and SVGs, and counts AI use against plan limits unless you bring your own key or subscription.

OpenPencil's [AI assistant](/user-guide/ai-chat) works with your own key for Anthropic, OpenAI, Google AI, OpenRouter, and other providers, with no usage limit of ours, or with the credits a Cloud plan includes. The same 100+ tools are open to coding agents through the [MCP server](/developers/mcp-server), and the desktop app runs [coding agents](/user-guide/coding-agents) such as Claude Code and Codex inside the editor, each with its own cursor on the canvas.

## Collaboration

OpenPencil edits together in real time: open a [peer-to-peer room](/user-guide/collaboration) with no server or account, or keep documents on [OpenPencil Cloud](/cloud/), hosted or on your own server, with sharing, comments, and version history. Pencil shares designs by link and live share, with comments and versions, on its own service.

## Where Pencil Is Ahead

- **Parallel agents.** Pencil runs up to six agents on one canvas on its top plan.
- **Generated images.** Pencil generates images and SVGs and removes backgrounds; OpenPencil vectorizes images through Recraft or fal.ai but doesn't generate them.
- **Code editor extension.** Pencil runs inside VS Code and Cursor; OpenPencil runs beside them.

## Which to Choose

Choose OpenPencil if you want an open-source editor you can host yourself, files in a format Figma also opens, and AI on your own keys without plan limits. Choose Pencil if you want several agents designing at once inside your code editor.
