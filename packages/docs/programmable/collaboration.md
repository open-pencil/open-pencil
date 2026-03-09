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

## Follow Mode

Click a collaborator's avatar in the top bar to follow their viewport. Your canvas pans and zooms to match their view. Click again to stop following.

## How It Works

Peers connect directly via WebRTC — your design data goes straight from browser to browser, never through a central server. The document state uses a CRDT (conflict-free replicated data type), so concurrent edits merge automatically without conflicts.

The room persists locally — if you refresh the page, you rejoin with the same state.

## Tips

- Works in the browser and the desktop app
- Room IDs are cryptographically random — only people with the link can join
- Stale cursors are cleaned up automatically when someone disconnects
