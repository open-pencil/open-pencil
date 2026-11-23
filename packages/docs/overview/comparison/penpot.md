---
title: OpenPencil vs Penpot
description: How OpenPencil and Penpot, two open-source design tools, differ in Figma file support, AI and automation, collaboration, self-hosting, and the desktop app.
---

# OpenPencil vs Penpot

OpenPencil and Penpot are both open-source design tools you can use instead of Figma. They start from different places: Penpot is a web platform built around its own file format and a team server, and OpenPencil is an editor that opens the Figma files you already have, runs on your device, and can be driven by you, scripts, or AI agents. This page compares them as of Penpot 2.19 and OpenPencil 0.17.

## At a Glance

|                    | OpenPencil                                                                                  | Penpot                                              |
| ------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| License            | MIT (editor), Apache 2.0 (Cloud server)                                                     | MPL 2.0                                             |
| Figma `.fig` files | Opens and saves them; copy and paste with Figma both ways                                   | Converted by a plugin that runs in Figma            |
| Where it runs      | Desktop app for macOS, Windows, and Linux, and the browser                                  | Browser                                             |
| Works offline      | Yes; documents can stay on your device                                                      | Needs its server                                    |
| Accounts           | Not needed to edit; optional for Cloud                                                      | Needed                                              |
| Collaboration      | Peer-to-peer rooms with no account, or OpenPencil Cloud with sharing, comments, and history | Server-based, with sharing, comments, and history   |
| Self-hosting       | OpenPencil Cloud server                                                                     | Docker deployment                                   |
| Built-in AI        | Chat assistant with 100+ design tools; bring your own provider key or use Cloud credits     | —                                                   |
| Agents and scripts | MCP server, headless CLI, and Figma Plugin API–compatible scripting                         | MCP server and Plugin API                           |
| Layout             | Auto layout with flexbox and CSS Grid                                                       | Flex and grid layout                                |
| Design tokens      | Variables with modes; W3C design tokens import and export                                   | Native design tokens                                |
| Code export        | Design JSX, HTML, Vue, and React with CSS or Tailwind                                       | CSS, SVG, and HTML inspection                       |
| Prototyping        | Live component behaviours; flows and transitions are on the [roadmap](/development/roadmap) | Flows, interactions, and a view mode                |

## Figma Files

OpenPencil opens `.fig` files directly and saves back to `.fig`, so a team can move without converting its library first, and anyone still on Figma can open the result. Complex files can still look different when reopened in Figma, so keep the original until you've checked the result. Copying layers in Figma and pasting them into OpenPencil keeps fills, strokes, auto layout, text, effects, and vector networks, and copying the other way works too. See [Figma compatibility](/reference/figma-compatibility) for what is and isn't carried over.

Penpot uses its own `.penpot` format and doesn't open `.fig` files. Moving from Figma means running Penpot's exporter plugin inside Figma and importing what it produces.

## AI and Automation

OpenPencil is built to be programmed. The [AI assistant](/user-guide/ai-chat) creates and edits layers with the same 100+ tools the [MCP server](/developers/mcp-server) gives Claude Code, Cursor, Codex, and other coding agents, and the desktop app can run those agents inside the editor. The [CLI](/developers/cli/inspecting) inspects, lints, converts, and exports documents without opening the editor, and its [`eval` command](/developers/cli/scripting) runs scripts written against the Figma Plugin API.

Penpot has an official MCP server that lets coding agents work on its files, and a plugin system for extensions that run in the editor. It has no built-in assistant or headless scripting.

## Collaboration and Hosting

Penpot is a client and server: documents live on a Penpot instance, either the hosted one or one you deploy with Docker, and everyone signs in to it.

OpenPencil keeps documents on your device by default. To edit together you can open a [peer-to-peer room](/user-guide/collaboration) with no account and nothing to host, with live cursors, follow mode, and voice calls. For shared storage, permissions, comments, and version history, use [OpenPencil Cloud](/cloud/): the hosted service or a [server your team runs](/cloud/self-hosting/) from the same open-source code.

## Desktop App

OpenPencil has a native desktop app for macOS, Windows, and Linux, with native menus, offline editing, and autosave. It also runs in the browser at [cloud.openpencil.dev](https://cloud.openpencil.dev). Penpot runs in the browser.

## Where Penpot Is Ahead

- **Maturity.** Penpot has been in production use for years by large teams; OpenPencil is younger and still has rough edges.
- **Prototyping.** Penpot has flows, interactions, and a presentation mode. OpenPencil previews components as working controls but has no prototype flows yet.
- **Plugin ecosystem.** Penpot has a catalogue of community plugins; OpenPencil's extension points today are scripts, MCP, and the [Vue SDK](/developers/sdk/).

## Which to Choose

Choose OpenPencil if you have Figma files to keep working with, want a desktop app that works offline, or want AI agents and scripts to work on your designs. Choose Penpot if you need prototyping today or a platform with a longer track record.
