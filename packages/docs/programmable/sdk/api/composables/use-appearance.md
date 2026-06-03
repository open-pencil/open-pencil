---
title: useAppearance
description: Control visibility, opacity, and corner radius state for the current selection.
---

# useAppearance

`useAppearance()` is the appearance-focused control composable for property panels.

It exposes selection-derived UI state for:

- visibility
- opacity
- corner radius
- independent corner radii

## Usage

```ts
import { useAppearance } from '@inkly/vue'

const appearance = useAppearance()
```

## Basic example

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Practical examples

### Toggle selection visibility

```ts
appearance.toggleVisibility()
```

### Edit per-corner radii

```ts
appearance.updateCornerProp('topLeftRadius', 12)
appearance.commitCornerProp('topLeftRadius', 12, 8)
```

## Related APIs

- [SDK API Overview](../)
- [useLayout](./use-layout)
- [useTypography](./use-typography)
