---
title: useStrokeControls
description: Stroke-panel state and actions for alignment, sides, caps, joins, and miter limits.
---

# useStrokeControls

`useStrokeControls()` is the stroke-property composable used by stroke editing panels.

It provides:

- stroke align options
- side presets like all, top, bottom, left, right, custom
- default stroke data
- helpers for per-side border weights
- mixed-selection cap, join, and miter-limit state
- undo-batched cap and join updates
- preview and commit actions for miter-limit fields

## Usage

```ts
import { useStrokeControls } from '@open-pencil/vue'

const strokes = useStrokeControls()
```

## Basic example

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
```

## Practical examples

### Set stroke alignment

```ts
strokes.updateAlign('INSIDE')
```

### Limit a stroke to one side

```ts
strokes.selectSide('TOP')
```

### Edit stroke geometry

```ts
strokes.setCap('ROUND')
strokes.setJoin('BEVEL')

strokes.updateMiterLimit(8)
strokes.commitMiterLimit(8)
```

`advancedActive` is true only when every selected node has at least one stroke. `cap`, `join`, and
`miterLimit` return the shared value or `MIXED` for a mixed selection.

Alignment, sides, and border weights act on every selected node in one undo step. `currentAlign()`
and `borderWeight(side)` return the shared value or `MIXED`; a node without strokes counts with the
alignment it keeps for new strokes.

## Related APIs

- [PropertyListRoot](../components/property-list-root)
