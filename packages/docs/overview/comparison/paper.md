---
title: OpenPencil vs Paper
description: How OpenPencil, an open-source design editor, and Paper, a commercial design canvas built on HTML and CSS, differ in Figma files, local use, AI agents, and price.
---

# OpenPencil vs Paper

[Paper](https://paper.design) is a commercial design tool whose canvas is built on HTML and CSS, made to work with AI coding agents through MCP. OpenPencil is an open-source design editor that opens Figma's `.fig` files, has its own AI assistant, and gives agents a full set of tools too. This page compares them as of Paper Desktop 0.5 and OpenPencil 0.17.

## At a Glance

|                     | OpenPencil                                                                                   | Paper                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| License             | Open source: MIT (editor), Apache 2.0 (Cloud server)                                         | Proprietary                                                               |
| Price               | Free; Cloud plans add storage, editors, and AI credits                                       | Free plan with 100 MCP calls a week; Pro per editor                       |
| Platforms           | Desktop app for macOS, Windows, and Linux, and the browser                                   | Desktop app for macOS, Windows, and Linux, and the browser                |
| Where files live    | On your device, in your own storage bucket, or on OpenPencil Cloud                           | Paper's service                                                           |
| Self-hosting        | OpenPencil Cloud server                                                                      | —                                                                         |
| Figma               | Opens and saves `.fig` files; copy and paste both ways                                       | Paste from Figma                                                          |
| Built-in AI         | Chat assistant with 100+ design tools; your own provider keys or Cloud credits               | Image and SVG generation; design work through external agents             |
| Coding agents       | MCP server, plus Claude Code, Codex, Cursor, and others running inside the editor            | Local and remote MCP servers                                              |
| Scripting           | Headless CLI and Figma Plugin API–compatible scripting                                       | CLI for its MCP server                                                    |
| Code export         | Design JSX, HTML, Vue, and React with CSS or Tailwind                                        | React with CSS or Tailwind                                                |
| Export              | PNG, JPG, WEBP, SVG, and `.fig`; PDF from the CLI                                            | PNG, SVG, PDF, and video                                                  |
| Collaboration       | Peer-to-peer rooms, or OpenPencil Cloud with comments and version history                    | Real-time editing with teammates and agents, and comments                 |

## Files and Hosting

Paper keeps designs on its own service. OpenPencil saves ordinary `.fig` files that Figma also opens, and lets you keep them on your device, in your own [storage bucket](/user-guide/cloud-storage), or on [OpenPencil Cloud](/cloud/), hosted or on a [server your team runs](/cloud/self-hosting/). It opens Figma files directly, where Paper takes layers pasted from Figma.

## AI and Agents

Both are made for agents. Paper has no built-in assistant: you design by hand, or connect an external agent such as Claude Code or Cursor over its MCP server, and its free plan allows 100 MCP calls a week.

OpenPencil has an [AI assistant](/user-guide/ai-chat) inside the editor, using your own provider key or Cloud credits, and the same 100+ tools are open to external agents through the [MCP server](/developers/mcp-server) without call limits. The desktop app can also run [coding agents](/user-guide/coding-agents) inside the editor, each with its own cursor on the canvas. The [CLI](/developers/cli/inspecting) and [`eval`](/developers/cli/scripting) work on documents without opening the editor at all.

## Where Paper Is Ahead

- **HTML and CSS canvas.** Paper's layers are web layout, so what you design is what a browser renders. OpenPencil lays out with flexbox and CSS Grid through Taffy and exports HTML, but its canvas is not a web page.
- **Generated media.** Paper generates images and SVGs and exports video.
- **Remote MCP.** Paper's hosted MCP server works while the app is closed.

## Which to Choose

Choose OpenPencil if you want an open-source editor, `.fig` files you keep, AI built in as well as through agents, or no limits on agent calls. Choose Paper if you want a canvas that is HTML and CSS throughout.
