---
title: Layers & Pages
description: Managing layers, pages, and the properties panel in OpenPencil.
---

# Layers & Pages

The editor interface has three main panels: layers (left), canvas (center), and properties (right). All panels are resizable by dragging the dividers.
## Layers Panel

The layers panel on the left displays the document hierarchy as a tree.

### Tree View

Nodes are shown in a collapsible tree. Click the chevron next to a frame, group, or component to expand or collapse its children.

### Drag Reorder

Drag layers to reorder them. Nodes higher in the list render on top.

### Visibility Toggle

Click the eye icon next to any layer to hide or show it on the canvas. Hidden nodes remain in the tree.

### Rename

Double-click a layer name to rename it inline. Press <kbd>Enter</kbd> or click away to commit, <kbd>Escape</kbd> to cancel.

### Selection Sync

Clicking a layer in the panel selects the corresponding node on the canvas, and vice versa.

## Pages Panel

The pages panel shows all pages in the document.

- **Switch page** — click a page tab to make it active. The canvas switches to that page and restores its viewport position.
- **Add page** — click the add button to create a new page
- **Delete page** — remove the current page
- **Rename page** — double-click the page name for inline editing. Pressing <kbd>Enter</kbd> or <kbd>Escape</kbd>, or clicking away, commits the rename.

Each page has its own canvas and viewport state.

## Properties Panel

The properties panel on the right has three tabs:

### Design Tab

Shows the properties of the selected node(s), organized in sections:

- **Appearance** — opacity, corner radius (with independent corner toggle), visibility
- **Fill** — solid color, gradients (linear, radial, angular, diamond), image fills, variable bindings
- **Stroke** — color, width, cap, join, dash pattern
- **Effects** — drop shadow, inner shadow, layer blur, background blur, foreground blur
- **Typography** — font family, size, weight, B/I/U/S formatting buttons (visible for text nodes)
- **Layout** — [auto layout](./auto-layout) controls (visible for auto-layout frames)
- **Export** — scale, format, and export button (see [Exporting](./exporting))

When no nodes are selected, the Design tab shows page-level properties including the canvas background color.

### Code Tab

Displays the selected node as code with syntax highlighting, line numbers, and a copy button. A format toggle lets you switch between two output modes:

- **OpenPencil JSX** — custom component tree compatible with `renderJsx()` for programmatic round-trip
- **Tailwind CSS v4** — HTML with utility classes (`<div className="flex gap-4 p-3">`) ready to paste into React/Vue projects

### AI Tab

An AI chat interface (also toggled with <kbd>⌘</kbd><kbd>J</kbd>) that can create and modify design elements via natural language. Supports multiple AI models through OpenRouter.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Toggle AI chat | <kbd>⌘</kbd><kbd>J</kbd> | <kbd>Ctrl</kbd> + <kbd>J</kbd> |

## Mobile Layout

On mobile and small screens, the side panels are replaced by a swipeable bottom drawer. Tabs at the top of the drawer switch between Layers, Properties, Design, and Code views. The toolbar collapses to a compact horizontal strip with category switching.

## Tips

- Panel widths are saved automatically — they persist across reloads.
- Use the layers panel to find overlapping nodes that are hard to click on the canvas.
- The [context menu](./context-menu) provides additional actions for selected nodes.
- See [Selection & Manipulation](./selection-and-manipulation) for z-order shortcuts (]/[) and visibility/lock toggles.
