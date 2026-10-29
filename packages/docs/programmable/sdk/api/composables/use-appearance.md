---
title: useAppearance
description: Control visibility, opacity, corner radius, and smoothing for the current selection.
---

# useAppearance

`useAppearance()` is the appearance-focused control composable for property panels.

It exposes selection-derived UI state for:

- visibility
- opacity
- corner radius
- corner smoothing as a normalized percentage
- independent corner radii, including imported unequal-corner state
- blend mode

## Usage

```ts
import { useAppearance } from '@open-pencil/vue/controls/appearance'

const appearance = useAppearance()
```

## Basic example

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  cornerSmoothingPercent,
  showIndependentCorners,
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

### Edit corner smoothing

```ts
appearance.updateCornerProp('cornerSmoothing', 0.75)
appearance.commitCornerProp('cornerSmoothing', 0.75, 0)
```

Render the per-corner editor from `showIndependentCorners`. It accounts for both the explicit
scene-node flag and imported nodes whose corner values differ. Multi-selection toggles and commits
are grouped into one undo entry.

## Related APIs

- [SDK API Overview](../)
- [useLayout](./use-layout)
- [useTypography](./use-typography)
