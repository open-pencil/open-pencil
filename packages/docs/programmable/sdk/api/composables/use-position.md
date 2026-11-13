---
title: usePosition
description: Read and update selected node position, size, rotation, alignment, and flipping.
---

# usePosition

`usePosition()` is a control composable for position-related UI.

`panelProp(key)` gives the value a field shows for `'x'`, `'y'`, `'width'`, `'height'`, or `'rotation'`: rounded to two decimals, as Figma's panel shows it, or `MIXED` when the selected layers show different values. The layers keep their exact values.

`x`, `y`, and `rotation` read as Figma's properties panel shows them: the top-left of the turned layer's box on the canvas, measured from its frame or page, and its counterclockwise angle. `updateProp('x' | 'y' | 'rotation', value)` moves or turns each selected node so it shows that value, turning about its center.

and actions like:

- align
- flip
- rotate
- scrub/update numeric properties

## Usage

```ts
import { usePosition } from '@open-pencil/vue/controls/position'

const position = usePosition()
```

## Basic example

```ts
const { panelProp, updateProp, commitProp } = usePosition()
const x = panelProp('x')
const width = panelProp('width')
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
