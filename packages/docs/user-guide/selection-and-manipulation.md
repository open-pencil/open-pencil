---
title: Selection & Manipulation
description: Selecting, moving, resizing, rotating, duplicating, and organizing nodes in OpenPencil.
---

# Selection & Manipulation

Select objects to move, resize, rotate, duplicate, and organize them on the canvas.
## Selecting

- **Click** a node to select it (deselects everything else). As in Figma, a click inside a top-level frame selects that frame's direct child, such as a nested frame or a group, rather than the deepest layer; click a top-level frame by its title, anywhere when it is empty, or by its gaps and padding when it has auto layout
- **Hover** an auto layout frame to see its direct children outlined with dotted lines; while a single layer is selected, the border of its auto layout parent is dotted
- **Double-click** to go one level deeper, or click again inside a selected frame, component, or instance; once a layer is selected, clicks reach its siblings and cousins directly
- <kbd>⌘</kbd> + click (<kbd>Ctrl</kbd> + click on Windows and Linux) selects the deepest layer under the cursor; holding <kbd>⌘</kbd> highlights that layer before you click
- <kbd>Shift</kbd> + click to add or remove a node from the current selection. A layer and its own parent or child are never selected together, so Shift-clicking one replaces the other
- **Double-click a frame's or component's name** above it on the canvas to rename it in place
- **Marquee drag** — drag on empty canvas to draw a selection rectangle; intersecting nodes are selected on release. Started inside a top-level frame without auto layout or a section, it selects that container's layers; from the page, a frame or section that holds layers is selected only when fully enclosed
- <kbd>⌘</kbd><kbd>A</kbd> — select all nodes on the current page
- **Click empty canvas** — deselect all

## Moving

- **Drag** a selected node to move it (all selected nodes move together)
- **Arrow keys** — nudge selected nodes by 1 px
- <kbd>Shift</kbd> + arrow keys — nudge by 10 px

## Resizing

Selected nodes show 8 resize handles (4 corners + 4 edge midpoints). Drag any handle to resize.

- <kbd>Shift</kbd> + drag a corner handle to constrain proportions

## Moving into and out of frames

A dragged node lands in the frame under the cursor when you release it, however little of it is inside, and leaves its frame as soon as the cursor does. Groups and locked frames never take dropped nodes, and a component set takes back only its own variants; a node inside a group stays in it unless you drop it on a different frame, and the group resizes to fit what it holds. A group whose last node leaves is removed. Pressing inside a selected frame, group, or component set drags it rather than the node under the cursor.

- <kbd>Shift</kbd> + drag — lock the move to one axis
- Hold <kbd>Space</kbd> while dragging — keep the nodes in their current parents
- <kbd>⌃</kbd> + drag (<kbd>Ctrl</kbd> + drag on Windows and Linux) — turn off snapping; dropped into an auto-layout frame, the node is positioned absolutely

Locked nodes in a selection stay where they are when the rest of it moves.

## Rotating

Hover just outside a corner handle to see the rotation cursor. Drag to rotate.

- <kbd>Shift</kbd> + drag snaps rotation to 15° increments

## Duplicating

- <kbd>Alt</kbd> + drag (<kbd>⌥</kbd> + drag on Mac) — duplicate the selected node and move the copy
- <kbd>⌘</kbd><kbd>D</kbd> — duplicate in place; a lone top-level frame's copy, on the page or in a section, goes into the first free space to its right

Duplicates keep their names. Duplicating a main component this way creates an instance of it.

## Pasting

<kbd>⌘</kbd><kbd>V</kbd> keeps the copied position. Pasted into a selected frame, nodes keep their offset from the frame they were copied from, and are centered along any axis where they don't fit; nodes that would land out of view are centered in it. Use **Paste here** in the [context menu](./context-menu) to paste at the cursor.

## Deleting

Press <kbd>Backspace</kbd> or <kbd>Delete</kbd> to remove all selected nodes.

## Z-Order

Change the stacking order of nodes within their parent:

- **]** — bring to front (top of sibling list)
- **[** — send to back (bottom of sibling list)

## Visibility & Lock

- <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> — toggle visibility. Hidden nodes don't render but stay in the layers panel.
- <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> — toggle lock. Locked nodes can't be selected or moved on canvas.

## Move to Page

Move selected nodes to a different page via the [context menu](./context-menu). The nodes are reparented under the target page's canvas.

## Sections

A section takes in the sibling nodes it fully covers when you draw it, move it, or resize it over them.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Select all | <kbd>⌘</kbd><kbd>A</kbd> | <kbd>Ctrl</kbd> + <kbd>A</kbd> |
| Duplicate | <kbd>⌘</kbd><kbd>D</kbd> | <kbd>Ctrl</kbd> + <kbd>D</kbd> |
| Duplicate + move | <kbd>⌥</kbd> + drag | <kbd>Alt</kbd> + drag |
| Move along one axis | <kbd>⇧</kbd> + drag | <kbd>Shift</kbd> + drag |
| Keep current parent | <kbd>Space</kbd> while dragging | <kbd>Space</kbd> while dragging |
| Move without snapping | <kbd>⌃</kbd> + drag | <kbd>Ctrl</kbd> + drag |
| Delete | <kbd>⌫</kbd> / Delete | <kbd>Backspace</kbd> / Delete |
| Nudge 1 px | <kbd>Arrow keys</kbd> | Arrow keys |
| Nudge 10 px | <kbd>⇧</kbd> + Arrow keys | <kbd>Shift</kbd> + <kbd>Arrow</kbd> keys |
| Bring to front | ] | ] |
| Send to back | [ | [ |
| Toggle visibility | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>H</kbd> |
| Toggle lock | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>L</kbd> |

## Tips

- Use the [Layers & Pages](./layers-and-pages) panel to see and reorder nodes when they overlap.
- See [Context Menu](./context-menu) for additional actions like grouping and component creation.
