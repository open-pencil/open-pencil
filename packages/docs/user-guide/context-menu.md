---
title: Context Menu
description: Right-click context menu actions in OpenPencil — clipboard, z-order, grouping, components, and more.
---

# Context Menu

Right-click on the canvas to open the context menu. If you right-click on a node, it is selected first. Right-clicking on empty canvas clears the selection.
## Copy/Paste as

The **Copy/Paste as** submenu offers additional clipboard formats for the selected node(s):

| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| Copy as text | — | — |
| Copy as SVG | — | — |
| Copy as PNG | ⇧ ⌘ C | Shift + Ctrl + C |
| Copy as JSX | — | — |

- **Copy as text** — copies visible text content from the selection
- **Copy as SVG** — copies the node tree as SVG markup
- **Copy as PNG** — renders at 2× and places on the system clipboard (paste into Slack, Notion, etc.)
- **Copy as JSX** — copies the OpenPencil JSX representation for use with `renderJsx()`

## Clipboard Actions

| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| Copy | ⌘ C | Ctrl + C |
| Cut | ⌘ X | Ctrl + X |
| Paste here | ⌘ V | Ctrl + V |
| Duplicate | ⌘ D | Ctrl + D |
| Delete | ⌫ | Backspace / Delete |

Clipboard actions are disabled when nothing is selected (except Paste, which is available when the clipboard has content).

## Z-Order

| Action | Shortcut |
|--------|----------|
| Bring to front | ] |
| Send to back | [ |

Moves the selected node to the top or bottom of its parent's child list.

## Grouping

| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| Group | ⌘ G | Ctrl + G |
| Ungroup | ⇧ ⌘ G | Shift + Ctrl + G |
| Add auto layout | ⇧ A | Shift + A |

- **Group** requires 2 or more selected nodes
- **Ungroup** appears when a group is selected — children are reparented to the group's parent
- **Add auto layout** wraps the selection in a new [auto layout](./auto-layout) frame

## Component Actions

Component actions are displayed in purple to match the component color theme.

| Action | Shortcut (Mac) | Shortcut (Win/Linux) | Available on |
|--------|----------------|----------------------|--------------|
| Create component | ⌥ ⌘ K | Ctrl + Alt + K | Frames, groups, multi-selection |
| Create component set | ⇧ ⌘ K | Shift + Ctrl + K | 2+ selected components |
| Create instance | — | — | Components (no shortcut) |
| Go to main component | — | — | Instances |
| Detach instance | ⌥ ⌘ B | Ctrl + Alt + B | Instances |

See [Components](./components) for details on the component workflow.

## Visibility & Lock

| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| Hide / Show | ⇧ ⌘ H | Shift + Ctrl + H |
| Lock / Unlock | ⇧ ⌘ L | Shift + Ctrl + L |

The label toggles based on the node's current state (e.g., "Hide" for a visible node, "Show" for a hidden one).

## Move to Page

The **Move to page** submenu lists all pages except the current one. Select a page to reparent the selected nodes under that page's canvas.

## Tips

- Right-clicking empty canvas gives you access to Paste — useful for placing content at a specific location.
- Component actions only appear when relevant (e.g., "Create instance" only for component nodes).
- The context menu mirrors the keyboard shortcuts — it's a good way to discover shortcuts you don't know yet.
