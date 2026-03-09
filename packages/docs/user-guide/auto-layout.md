---
title: Auto Layout
description: Flexbox-based auto layout in OpenPencil — direction, gap, padding, alignment, and child sizing.
---

# Auto Layout

Auto layout positions children automatically within a frame using flexbox rules. It handles direction, spacing, alignment, and responsive sizing.
## Enabling Auto Layout

- Select a frame and press <kbd>⇧</kbd><kbd>A</kbd> (<kbd>Shift</kbd> + <kbd>A</kbd>) to toggle auto layout on or off
- Select loose nodes (without a parent frame) and press <kbd>⇧</kbd><kbd>A</kbd> to wrap them in a new auto-layout frame

When wrapping a selection, nodes are sorted by visual position: left-to-right for horizontal layout, top-to-bottom for vertical.

## Layout Direction

Choose how children are arranged:

- **Horizontal** — children flow left to right
- **Vertical** — children flow top to bottom
- **Wrap** — children wrap to the next row/column when they run out of space

## Spacing

### Gap

The space between adjacent children. Set a single value that applies between all children.

### Padding

The space between the frame edge and its children. Set a uniform value for all sides, or expand to set each side independently (top, right, bottom, left).

## Alignment

### Justify (main axis)

Controls how children are distributed along the layout direction:

- **Start** — children pack to the beginning
- **Center** — children are centered
- **End** — children pack to the end
- **Space between** — children spread with equal space between them

### Align (cross axis)

Controls how children are positioned perpendicular to the layout direction:

- **Start** — children align to the start
- **Center** — children are centered
- **End** — children align to the end
- **Stretch** — children stretch to fill the cross axis

## Child Sizing

Each child in an auto-layout frame can have its own sizing mode:

- **Fixed** — uses the child's explicit width/height
- **Fill** — stretches to fill available space in the parent
- **Hug** — shrinks to fit the child's content

## Drag Reordering

Within an auto-layout frame, drag a child to reorder it among its siblings. A visual insertion indicator shows where the child will be dropped.

## Properties Panel

When an auto-layout frame is selected, the Layout section in the properties panel shows all auto-layout controls: direction, gap, padding, justify, and align.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Toggle auto layout | <kbd>⇧</kbd><kbd>A</kbd> | <kbd>Shift</kbd> + <kbd>A</kbd> |

## Tips

- Auto layout recomputes immediately after creation, so the selection bounds update right away.
- Nest auto-layout frames for complex responsive layouts (e.g., a vertical frame containing horizontal rows).
- Use "Fill" sizing to make a child take up remaining space, like a flex-grow: 1 in CSS.
- See [Drawing Shapes](./drawing-shapes) for creating the frames that auto layout applies to.
- See [Components](./components) for using auto layout within reusable components.
