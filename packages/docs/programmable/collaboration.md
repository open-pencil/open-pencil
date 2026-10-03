---
title: Collaboration
description: Real-time collaborative editing via P2P WebRTC — no server, no account.
---

# Collaboration

Edit designs together in real time. Peers connect directly — no server relays your data, no account required.

## Sharing a Room

1. Click the share button in the top-right corner
2. Copy the generated link (`app.openpencil.dev/share/<room-id>`)
3. Send it to your collaborators

Anyone with the link can join. The room stays active as long as at least one participant has the page open.

## What Syncs

- **Document changes** — every edit (shapes, text, properties, layout) syncs instantly
- **Cursors** — see where each collaborator is pointing, with their name and color
- **Selections** — highlighted selections are visible to everyone
- **Agents** — the built-in AI chat appears as a cursor at the layers it is editing, its outlined label showing a sparkle and a callsign such as *Fern*. The cursor and outline have the color of the person running it, so you can tell whose agent it is. Only its name, kind, model, status, page, position, and edited layers are shared, never prompts or replies.

## Follow Mode

Click a collaborator's avatar in the top bar to follow their viewport. Your canvas pans and zooms to match their view, and a frame in their color with a “Following …” bar shows whom you follow. Click the avatar again, press <kbd>Esc</kbd>, or click, scroll, zoom, or switch pages yourself to stop.

An avatar counts the agents that person runs. Hover over it to see each agent, what it is doing, and on which page, and click **Follow** next to an agent to keep the page and layers it is editing in view; following continues between its replies and stops when it leaves. The button after the avatars lists everyone in the room with their agents, and works from the keyboard. Your own avatar lists your agents — click one to rename it — and has **Leave room**.

## How It Works

Peers connect directly via WebRTC — your design data goes straight from browser to browser, never through a central server. The document state uses a CRDT (conflict-free replicated data type), so concurrent edits merge automatically without conflicts.

The room persists locally — if you refresh the page, you rejoin with the same state.

## Tips

- Works in the browser and the desktop app
- Room IDs are cryptographically random — only people with the link can join
- Stale cursors are cleaned up automatically when someone disconnects
