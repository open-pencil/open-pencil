---
title: usePosition
description: Read and update selected node position, size, rotation, alignment, and flipping.
---

# usePosition

`usePosition()` is a control composable for position-related UI.

It exposes selected-node values like:

- `x`
- `y`
- `width`
- `height`
- `rotation`

`x`, `y`, and `rotation` read as Figma's properties panel shows them: the top-left of the turned layer's box on the canvas, measured from its frame or page, and its counterclockwise angle. `updateProp('x' | 'y' | 'rotation', value)` moves or turns each selected node so it shows that value, turning about its center. `panelProp(key)` gives the shared value across a multi-selection, or `MIXED`.

and actions like:

- align
- flip
- rotate
- scrub/update numeric properties

## Usage

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Basic example

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Practical examples

### Align selected nodes

```ts
position.align('horizontal', 'center')
position.align('vertical', 'min')
```

### Flip selection

```ts
position.flip('horizontal')
position.flip('vertical')
```

### Rotate selection

```ts
position.rotate(90)
```

## Related APIs

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
