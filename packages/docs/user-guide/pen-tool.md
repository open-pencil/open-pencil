---
title: Pen Tool
description: Drawing vector paths with bezier curves using the pen tool in OpenPencil.
---

# Pen Tool

The pen tool creates vector paths using a vector network data model, compatible with Figma's .fig format.
## Activating

Press <kbd>P</kbd> to activate the pen tool.

## Placing Points

- **Click** to place a corner point (straight-line segment)
- **Click + drag** to place a curve point with bezier tangent handles — the drag direction and length control the curve shape
  - **Hold <kbd>Space</kbd>** while dragging (without releasing the mouse button) to move the point itself

Click multiple points to build a path segment by segment. A preview line extends from the last placed point to your cursor as you move.

## Closing a Path

Click on the **first point** of the path to close it into a loop. Closed paths can be filled.

## Open Paths

Press <kbd>Escape</kbd> to commit the current path as an open path. Open paths render as strokes only — they're not filled.

## Vector Networks

Paths in OpenPencil use vector networks — a more flexible model than simple point lists that supports branching paths and complex topology. This is the same model Figma uses, so paths round-trip perfectly in .fig files.

## Pencil

Press <kbd>⇧</kbd><kbd>P</kbd>, or pick Pencil from the pen tool's menu in the toolbar, to draw freehand. Each stroke becomes its own vector layer, smoothed into curves you can edit like any other path, and the pencil stays active for the next stroke.

- Zoom in to keep more detail: the curve follows your stroke to within a few screen pixels.
- Hold <kbd>Shift</kbd> to draw straight, horizontally or vertically, from where you pressed it.
- End a stroke where it started to close it into a loop.
- A stroke goes into the frame that holds all of it, otherwise onto the page.
- New strokes contrast with what they are drawn on. Change the stroke of the last one you drew, and the pencil keeps that style.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Pen tool | <kbd>P</kbd> | <kbd>P</kbd> |
| Pencil | <kbd>⇧</kbd><kbd>P</kbd> | <kbd>Shift</kbd>+<kbd>P</kbd> |
| Commit open path | <kbd>Escape</kbd> | Escape |

## Tips

- The preview line always starts from the last placed point — it won't jump to (0,0).
- Drag longer when placing a curve point to make the curve wider.
- After creating a path, use the properties panel to adjust its fill, stroke, and effects.
