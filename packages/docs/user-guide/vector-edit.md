---
title: Vector Object Editing
description: 'How to edit vector path geometry: anchors, bezier handles, modifiers, and Pen tool actions in edit mode.'
---

# Vector Object Editing

Vector Object Editing mode lets you change a curve's **geometry**: anchor positions, segment shape, and bezier handles.  
In this mode, you edit the path itself, not standard object transforms.

## Entering the Mode

- Select a vector object with the Select tool.
- **Double-click the curve**.

This activates geometry editing for the selected vector.

## Exiting the Mode

- Press <kbd>Escape</kbd>.
- Click empty space on the canvas.
- Or switch to another editing context.

## What Changes in This Mode

- The normal transform bounding box is disabled for the object.
- Anchor, segment, and handle editing becomes available.
- Cursor behavior does not switch to resize/rotate at bbox corners.

## Basic Actions

### Move an Anchor

- Drag an anchor point.
- Connected segments and path shape update live in preview.

### Edit a Bezier Handle

- Drag a handle on the anchor.
- By default, behavior follows the anchor's current handle composition.

### Select and Move a Segment

- Click a segment to select it. The segment turns blue and shows a knob at its midpoint; its anchors stay unselected.
- <kbd>Shift</kbd> + click adds a segment to the selection, or removes a selected one.
- Drag a segment to move the two anchors it joins, along with the rest of the selection.

### Select with a Marquee

- Drag over empty space to select the anchors inside the rectangle and the segments between them.
- <kbd>Shift</kbd> + drag adds them to the selection.

### Select a Region

- Move the pointer inside a filled area: the region under it is hatched with diagonal lines.
- Click inside it to select the region and all of its points; drag to move it.
- <kbd>Shift</kbd> + click adds the region to the selection.

### Delete Anchors and Segments

- Press <kbd>Delete</kbd> or <kbd>Backspace</kbd> to delete the selection.
- A deleted anchor takes its segments with it.
- A deleted segment takes only the anchors it leaves unconnected, so deleting the middle segment of a path splits it in two.
- Deleting everything deletes the layer.

## Handle Drag Modifiers

| Action                           | Mac                      | Windows / Linux         |
| -------------------------------- | ------------------------ | ----------------------- |
| Continuous (Smooth / Continuous) | <kbd>Cmd</kbd> + drag    | <kbd>Ctrl</kbd> + drag  |
| Corner (Independent handles)     | <kbd>Option</kbd> + drag | <kbd>Alt</kbd> + drag   |
| Direction lock (length only)     | <kbd>Shift</kbd> + drag  | <kbd>Shift</kbd> + drag |

### Continuous: <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + drag

- The active handle is constrained to the same line as the sister handle.
- Only the active handle length changes.
- Use this for smooth transitions without a corner break.

### Corner: <kbd>Option</kbd>/<kbd>Alt</kbd> + drag

- The active handle is edited independently.
- The sister handle stays in place.
- Use this to create a sharp corner transition.

### Direction Lock: <kbd>Shift</kbd> + drag

For anchors with **Continuous** or **Symmetric** composition:

- handle direction is locked to the value from **before the current drag started**;
- dragging changes only handle length (or lengths, depending on composition).

## Bend Override by Dragging an Anchor

When you drag an anchor while holding <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>, the editor selects the target handle by **segment attachment direction** at that anchor (not by nearest neighbor-point distance).  
This also works on multi-branch vector-web anchors: once resolved, the target handle stays locked for the current drag.

## Using the Pen Tool in Edit Mode

With the Pen tool active:

- **Click a segment** to insert a new anchor (split segment).
- **Click an open-path endpoint** to resume drawing from that point.
- **Option/Alt + click an anchor** to delete it (when topology allows).

For path creation and closing behavior, see [Pen Tool](./pen-tool.md).

## Practical Workflow

1. Draw a shape with the Pen tool.
2. Double-click the curve to enter Vector Object Editing mode.
3. Move anchors to refine the silhouette.
4. Drag handles:
   - with <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> for smooth continuous transitions,
   - with <kbd>Option</kbd>/<kbd>Alt</kbd> for independent edits,
   - with <kbd>Shift</kbd> for length-only edits.
5. Press <kbd>Escape</kbd> to exit.
