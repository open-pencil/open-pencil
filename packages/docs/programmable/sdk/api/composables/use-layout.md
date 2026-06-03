---
title: useLayout
description: Work with auto-layout, sizing, padding, alignment, and grid tracks.
---

# useLayout

`useLayout()` is the main control composable for layout-related panels.

It exposes state and actions for:

- flex vs grid mode
- width/height sizing
- padding
- alignment
- grid template track editing

## Usage

```ts
import { useLayout } from '@inkly/vue'

const layout = useLayout()
```

## Basic example

```ts
const {
  isGrid,
  isFlex,
  widthSizing,
  heightSizing,
  setWidthSizing,
  setHeightSizing,
} = useLayout()
```

## Practical examples

### Toggle between uniform and individual padding UI

```ts
layout.toggleIndividualPadding()
```

### Update grid tracks

```ts
layout.updateGridTrack('gridTemplateColumns', 0, { sizing: 'FIXED', value: 240 })
layout.addTrack('gridTemplateRows')
```

### Change alignment

```ts
layout.setAlignment('CENTER', 'MAX')
```

## Related APIs

- [usePosition](./use-position)
- [useEditor](./use-editor)
