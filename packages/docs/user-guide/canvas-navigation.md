---
title: Canvas Navigation
description: Panning, zooming, ruler guides, snapping, and distance measurements in OpenPencil.
---

# Canvas Navigation

The canvas is your infinite workspace. You can pan and zoom freely to navigate your design.

## Panning

Move the visible area of the canvas without affecting any objects.

- <kbd>Space</kbd> + drag — hold Space and drag anywhere on the canvas
- **Middle mouse drag** — press and drag the middle mouse button
- **Two-finger trackpad** — swipe with two fingers on a trackpad
- <kbd>Shift</kbd> + mouse wheel — pan horizontally

## Hand Tool

Press <kbd>H</kbd> to activate the hand tool for continuous panning. Any drag on the canvas pans the viewport without needing to hold Space. Switch to another tool (e.g., **V** for Select) to deactivate.

## Zooming

Zoom in and out centered on your cursor position.

- <kbd>Ctrl</kbd> + scroll (or <kbd>⌘</kbd> + scroll on Mac) — scroll up to zoom in, scroll down to zoom out
- **Pinch gesture** — pinch on a trackpad to zoom in/out
- **Keyboard shortcuts** — see table below

Pinch-to-zoom on UI panels (layers, properties) is prevented so it doesn't accidentally change the browser zoom level.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Pan | <kbd>Space</kbd> + drag | <kbd>Space</kbd> + drag |
| Hand tool | <kbd>H</kbd> | <kbd>H</kbd> |
| Zoom in | <kbd>⌘</kbd><kbd>+</kbd> | <kbd>Ctrl</kbd> + <kbd>+</kbd> |
| Zoom out | <kbd>⌘</kbd><kbd>−</kbd> | <kbd>Ctrl</kbd> + <kbd>−</kbd> |
| Zoom to 100% | <kbd>⌘</kbd><kbd>0</kbd> | <kbd>Ctrl</kbd> + <kbd>0</kbd> |

## Ruler Guides

Enable **View → Rulers**, then drag from the top ruler for a horizontal guide or the left ruler for a vertical guide. Drop onto the page for a canvas guide, or onto a frame for a guide in that frame's coordinates.

- Click a guide to select it; drag it to reposition it or transfer it between the page and a frame.
- Hold <kbd>Option</kbd> / <kbd>Alt</kbd> while dragging an existing guide to duplicate it.
- Drag a guide back onto a ruler to remove it, or use its context menu's **Remove guide** action.
- Guide changes support undo/redo and are preserved in `.fig` files.

## Snapping

Under **View → Preferences**, toggle **Snap to Geometry**, **Snap to Objects**, and **Snap to Pixel Grid** independently. Preferences are saved between sessions.

Geometry and object snapping help align vector points, moved layers, and resized edges with nearby geometry, objects, guides, and frame bounds. Alignment lines appear for those targets; pixel-grid rounding does not draw an alignment line for every pixel.

Hold <kbd>Control</kbd> during a layer drag to temporarily bypass object and pixel snapping, including on macOS where this is Control, not Command.

## Distance Measurements

Select a layer, hold <kbd>Option</kbd> on macOS or <kbd>Alt</kbd> on Windows/Linux, and hover another layer to see temporary distance measurements. Releasing the modifier clears the overlay; it does not add guides or change the document.

## Command Palette

Press <kbd>⌘</kbd><kbd>K</kbd> on macOS or <kbd>Ctrl</kbd> + <kbd>K</kbd> on Windows/Linux to search editor and application actions. Select a result to run it; unavailable actions remain subject to the current selection and document state.

The palette also moves between pages. Before you type, it lists the pages you visited recently in this tab, most recent first, and **Go to page…** opens a list of every page. Typing a page name finds it too. Pages where collaborators or AI agents are working list their names; the Pages panel marks the same pages with their colors.

## Tips

- Zooming always targets the cursor position, so point at what you want to see closer.
- The hand tool is useful when you need to pan frequently — it stays active until you switch tools.
- See [Selection & Manipulation](./selection-and-manipulation) for how to work with objects on the canvas.
