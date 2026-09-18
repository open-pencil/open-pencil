---
layout: doc
title: Automation
description: AI chat, CLI, JSX renderer, MCP server, and other automation surfaces built on the OpenPencil editor engine.
---

# Automation

OpenPencil treats design files as data. Every operation available in the editor — creating shapes, setting fills, managing auto-layout, exporting assets — is also available from the terminal, from AI agents, and from code. No plugins to install, no API keys, no waiting list.

The editor UI and the automation interfaces use the same engine. If you can do it by clicking, you can do it by scripting.

## The bigger idea

OpenPencil is not just meant to be a design app.

It is also meant to be a toolkit: something you can embed into other products, wrap with your own UI, and use to build editing workflows that fit your own domain.

That is why the automation surface matters. The app, the CLI, the AI tools, the JSX renderer, the MCP server, and the SDK all build on the same underlying editor engine.

## AI Chat

The built-in assistant has access to 90+ tools that cover the full surface of the editor. Describe what you want in natural language — "add a 16px drop shadow to all buttons", "create a card component with dark mode variant", "export every frame on this page at 2×".

[AI Chat →](./ai-chat)

## Collaboration

Real-time multiplayer editing over peer-to-peer WebRTC. No server, no account. Share a room link and edit together with live cursors and follow mode. Document state syncs via CRDT, so edits merge automatically even on flaky connections.

[Collaboration →](./collaboration)

## Vue SDK

Build OpenPencil-powered editors with the same Vue SDK the app uses internally. The SDK exposes editor context, canvas wiring, selection state, command models, property-panel composables, and headless primitives.

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

Connect Claude Code, Cursor, Windsurf, or any MCP-compatible client to OpenPencil. The server exposes 90 tools for reading, creating, and modifying designs — the same tools the built-in AI chat uses. Runs over stdio or HTTP with session support.

[MCP Server →](./mcp-server)

## URL scheme

The desktop app registers `openpencil://`, so a published page — a Storybook story, a design review, a README — can link straight to a layer:

```
openpencil://open?file=web/design/hikyo.pen&node=Button/Large/Default
```

`file` is a repository-relative path ending in `.pen` or `.fig`; absolute paths and `.` or `..` segments are refused. `node` is optional. Both values are URL-encoded — path separators may stay literal, but a literal `+` must be sent as `%2B` — and a repeated key takes its last value.

The app matches `file` against the paths of the open tabs as a whole trailing segment sequence, and focuses that tab without re-reading the document, so a file that moved or turned unreadable since it opened still gets its layer selected. The first open tab whose path ends with the requested path wins, which matters when two checkouts have the same file open. Segments are compared the way the platform's filesystem does: ASCII-case-insensitively on macOS and Windows, exactly on Linux, so `Web/Design/hikyo.pen` and `web/design/hikyo.pen` are the same file on a Mac and two different ones on Linux. If no open tab matches, a file picker asks for the file once; the picked file must end with the same relative path, otherwise the link is cancelled. No path is joined onto a root and no filesystem access is granted beyond what the picker returns. A file the link actually opens — the picked one — joins the recent-files list like any other file you open; focusing a tab that was already open does not touch the list, because nothing was opened.

With a node name, the app selects every layer carrying that exact name on the current page and zooms the view to the whole selection. An unknown name shows a notice and leaves the document open. Opening a file and selecting layers is all the scheme can do.

The web app takes the same link from its own address bar:

```
https://app.openpencil.dev/?file=https://raw.githubusercontent.com/open-pencil/open-pencil/master/tests/fixtures/pencil_button.pen&node=Button/Large/Default
```

Here `file` is an absolute `https:` URL ending in `.pen` or `.fig` — the web app has no filesystem, so a relative path, an `http:` URL or any other extension is refused with a console warning and nothing else. The extension is read off the URL's path, so a query string on the linked file changes nothing. A fragment is dropped before the fetch: it never reaches the server, so `…/hikyo.pen#a` and `…/hikyo.pen#b` open one tab, not two. `node` behaves exactly as above: the same exact-name selection and zoom, the same notice when no layer carries the name. Both values are URL-encoded, a literal `+` must be sent as `%2B`, and a repeated key takes its last value, as on the desktop. The link is handled on any route, so `/share/<room>?file=…` and `/demo?file=…` work like `/?file=…`.

The browser fetches the file cross-origin, so the host must allow it: `raw.githubusercontent.com` sends `Access-Control-Allow-Origin: *` and works. The request carries no credentials and refuses to follow redirects, which keeps an `https:` link from being bounced to a plaintext one — a `https://github.com/<owner>/<repo>/raw/...` URL redirects to `raw.githubusercontent.com` and is therefore refused, so link to the raw host directly. `file` and `node` are stripped from the address bar through the router as soon as they are read — before the fetch, and also when the link was refused — so a reload does not re-open the document, and neither a copied URL nor a later in-app navigation carries the link payload. A linked document is capped at 64 MiB: the body is counted as it streams in, not trusted from `Content-Length`, and the request is aborted the moment it goes over, with the link reporting that the file exceeds 64 MiB. A deployment that serves the app under a Content-Security-Policy must allow the linked host in `connect-src`, otherwise the fetch is blocked and the link reports that it could not open the file.

On macOS the scheme belongs to the installed app bundle, so links reach an installed build and not a `tauri dev` process. On Windows and Linux the link arrives through the deep-link plugin, including when the app is not running yet: the link is queued at startup and handled once the editor is ready; on Linux the bundled desktop entry passes the link through `%U`.

## Why Open?

Figma is a closed platform. Their MCP server is read-only. CDP browser access was killed in version 126. Design files live in a proprietary format on someone else's servers. Plugin development requires a custom runtime with limited APIs.

OpenPencil is the alternative: open source, MIT licensed, every operation scriptable, data stored locally. Your design files are yours — inspect them, transform them, pipe them into CI, feed them to an LLM. No permission needed.
