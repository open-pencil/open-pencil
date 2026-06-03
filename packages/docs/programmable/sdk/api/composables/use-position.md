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

and actions like:

- align
- flip
- rotate
- scrub/update numeric properties

## Usage

```ts
import { usePosition } from '@inkly/vue'

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
