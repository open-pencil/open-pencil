---
title: useStrokeControls
description: Stroke-panel helpers for alignment, side selection, and per-side stroke weights.
---

# useStrokeControls

`useStrokeControls()` is the stroke-property composable used by stroke editing panels.

It provides:

- stroke align options
- side presets like all, top, bottom, left, right, custom
- default stroke data
- helpers for per-side border weights

## Usage

```ts
import { useStrokeControls } from '@inkly/vue'

const strokes = useStrokeControls()
```

## Basic example

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
```

## Practical examples

### Set stroke alignment

```ts
strokes.updateAlign('INSIDE', activeNode)
```

### Limit a stroke to one side

```ts
strokes.selectSide('TOP', activeNode)
```

## Related APIs

- [PropertyListRoot](../components/property-list-root)
