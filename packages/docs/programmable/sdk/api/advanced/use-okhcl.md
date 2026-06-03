---
title: useOkHCL
description: Work with RGBA and OkHCL color models for fills and strokes.
---

# useOkHCL

`useOkHCL()` exposes helpers for reading, enabling, disabling, and updating OkHCL color values on node fills and strokes.

Use it when you are building advanced color tooling that needs to switch between standard RGBA editing and perceptual OkHCL editing.

## Usage

```ts
import { useOkHCL } from '@inkly/vue'

const okhcl = useOkHCL()
```

## Returns

- `getFillColorModel()`
- `getStrokeColorModel()`
- `getFillOkHCLColor()`
- `getStrokeOkHCLColor()`
- `enableFillOkHCL()`
- `disableFillOkHCL()`
- `enableStrokeOkHCL()`
- `disableStrokeOkHCL()`
- `updateFillOkHCL()`
- `updateStrokeOkHCL()`
- `modelOptions`

## Related APIs

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
