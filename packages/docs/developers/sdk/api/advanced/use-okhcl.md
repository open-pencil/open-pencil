---
title: useOkHCL
description: Persist OkHCL intent for selected node fills and strokes.
---

# useOkHCL

`useOkHCL()` is the editor-aware adapter for OkHCL fill and stroke metadata. It reads stored color
intent, updates nodes with undo, reports preview gamut information, and remembers the selected
field format for each fill or stroke.

Use [`useColorModel()`](../composables/use-color-model) for framework-agnostic conversion, channel
editing, and slider presentation. Use `useOkHCL()` only where those edits need to be persisted to an
OpenPencil editor.

## Usage

```ts
import { useOkHCL } from '@open-pencil/vue/controls/okhcl'

const okhcl = useOkHCL()

const color = okhcl.getFillOkHCLColor(node, 0)
okhcl.updateFillOkHCL(node, 0, { c: 0.2 })
```

## Format state

```ts
const format = okhcl.getFieldFormat(node, 0, 'fill')
okhcl.setFillFieldFormat(node, 0, 'okhcl')
```

Selecting `okhcl` initializes intent from the fill or stroke's current RGBA color. The returned
`fieldOptions` can be used to build a format selector.

## Preview information

```ts
const preview = okhcl.getFillPreviewInfo(node, 0)
// { previewColorSpace, clipped }
```

Preview information reflects the document render color space and whether the stored OkHCL intent
needed gamut mapping.

## Returns

- `getFillOkHCLColor()` / `getStrokeOkHCLColor()`
- `getFillPreviewInfo()` / `getStrokePreviewInfo()`
- `getFieldFormat()`
- `setFillFieldFormat()` / `setStrokeFieldFormat()`
- `updateFillOkHCL()` / `updateStrokeOkHCL()`
- `fieldOptions`

## Related APIs

- [useColorModel](../composables/use-color-model)
- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
