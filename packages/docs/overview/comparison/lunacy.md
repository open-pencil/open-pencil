---
title: OpenPencil vs Lunacy
description: How OpenPencil and Lunacy, two free desktop design editors that open Figma files, differ in licensing, saving back to Figma, AI and automation, and self-hosting.
---

# OpenPencil vs Lunacy

[Lunacy](https://icons8.com/lunacy) by Icons8 and OpenPencil are both free design editors with native desktop apps for macOS, Windows, and Linux, and both open Figma's `.fig` files. They differ in who controls the software and in where your work goes afterwards. This page compares them as of Lunacy 14 and OpenPencil 0.17.

## At a Glance

|                     | OpenPencil                                                                                  | Lunacy                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| License             | Open source: MIT (editor), Apache 2.0 (Cloud server)                                        | Proprietary freeware                                                      |
| Price               | Free; Cloud plans add storage, editors, and AI credits                                      | Free; paid plans for cloud and team features and unattributed graphics    |
| Platforms           | Desktop app for macOS, Windows, and Linux, and the browser                                  | Desktop app for macOS, Windows, and Linux, and the browser                |
| Native format       | Figma `.fig`                                                                                | `.free` and Sketch `.sketch`                                              |
| `.fig` files        | Opens and saves them; copy and paste with Figma both ways                                   | Opens them                                                                |
| Works offline       | Yes                                                                                         | Yes, with local documents                                                 |
| Collaboration       | Peer-to-peer rooms or OpenPencil Cloud, with comments and version history                   | Lunacy's cloud, with comments; private cloud for teams                    |
| Self-hosting        | OpenPencil Cloud server                                                                     | —                                                                         |
| Built-in AI         | Chat assistant with 100+ design tools; your own provider keys or Cloud credits              | AI chat on Icons8's service, plus image tools                             |
| Coding agents       | MCP server, plus Claude Code, Codex, Cursor, and others running inside the editor           | MCP server                                                                |
| Scripting           | Headless CLI and Figma Plugin API–compatible scripting                                      | Plugins through its MCP API                                               |
| Code export         | Design JSX, HTML, Vue, and React with CSS or Tailwind                                       | CSS inspection                                                            |
| Prototyping         | Live component behaviours; flows and transitions are on the [roadmap](/development/roadmap) | Flows, smart animate, and spring animations                               |
| Built-in assets     | Icon sets                                                                                   | Icons, photos, illustrations, and UI kits from Icons8                     |

## Working With Figma Files

Lunacy opens `.fig` files and saves its own `.free` format or Sketch files, so a design that leaves Figma for Lunacy doesn't go back as a `.fig`. OpenPencil saves `.fig` itself: you can open a file from a colleague on Figma, change it, and send it back, and copy and paste layers between the two apps in either direction. See [Figma compatibility](/reference/figma-compatibility) for what is carried over.

## Open Source and Hosting

Lunacy is free to use, but closed: Icons8 decides what it does and runs its cloud. OpenPencil's code is open, and documents can stay on your device, in your own [storage bucket](/user-guide/cloud-storage), or on [OpenPencil Cloud](/cloud/), including a [server your team runs](/cloud/self-hosting/).

## AI and Automation

Lunacy's AI chat runs on Icons8's service without needing an API key. OpenPencil's [AI assistant](/user-guide/ai-chat) uses your own provider key or Cloud credits, and the same 100+ tools are open to coding agents through the [MCP server](/developers/mcp-server). The [CLI](/developers/cli/inspecting) inspects, lints, and exports documents without opening the editor, and [`eval`](/developers/cli/scripting) runs scripts written against the Figma Plugin API.

## Where Lunacy Is Ahead

- **Prototyping.** Lunacy has flows, smart animate, and spring animations; OpenPencil has no prototype flows yet.
- **Built-in graphics.** Lunacy includes Icons8's icons, photos, illustrations, and UI kits.
- **Maturity.** Lunacy has been developed for years and reached version 14.

## Which to Choose

Choose OpenPencil if you need to keep exchanging `.fig` files with Figma users, want software and hosting you control, or want coding agents and scripts to work on your designs. Choose Lunacy if you want prototyping and a large built-in graphics library in a free app.
