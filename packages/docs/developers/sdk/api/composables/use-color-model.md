---
title: useColorModel
description: Build precise reactive color controls across RGB, HSL, HSB, and OkHCL.
---

# useColorModel

`useColorModel()` is the shared color-state and conversion layer for custom color pickers. It accepts
a scene-graph color, exposes Reka-compatible RGB/HSL/HSB values, and keeps optional OkHCL intent
separate from the gamut-mapped preview color.

The composable does not require an editor context and does not mutate the scene graph directly.
Pass callbacks to connect it to your own state or persistence layer.

## Basic usage

```ts
import { ref } from 'vue'
import { useColorModel } from '@open-pencil/vue/controls/color-model'
import type { Color } from '@open-pencil/scene-graph/primitives'

const color = ref<Color>({ r: 0.25, g: 0.5, b: 0.9, a: 1 })

const model = useColorModel({
  color,
  onUpdate: (nextColor) => {
    color.value = nextColor
  },
})

model.updateHSLChannel('s', 72)
model.updateAlpha(0.8)
```

The returned `hex`, `rekaColor`, `rgb`, `hsl`, and `hsb` values are computed refs. Use
`updateHex()` for hex input; it preserves the current alpha. RGB conversion keeps fractional
channel precision rather than rounding through 8-bit values.

## Format state

The built-in format identifiers are `hex`, `rgb`, `hsl`, `hsb`, and `okhcl`. The type remains
extensible so applications can add another presentation format without changing the model.

```ts
const model = useColorModel({
  color,
  defaultFormat: 'hsl',
  onFormatChange: (format) => savePreferredFormat(format),
})

model.setFormat('okhcl')
```

Pass `format` for controlled state. Without it, `setFormat()` updates local reactive state.

## OkHCL intent

A scene-graph color contains a renderable RGBA value, but it cannot retain an out-of-gamut OkHCL
source by itself. Pass the source intent separately and persist patches through `onUpdateOkHCL`:

```ts
const model = useColorModel({
  color,
  okhcl: () => storedOkhcl.value,
  onUpdateOkHCL: (patch) => {
    storedOkhcl.value = { ...storedOkhcl.value, ...patch }
  },
})

model.updateOkHCLChannel('c', 0.24)
```

When no OkHCL callback is supplied, OkHCL edits emit a gamut-mapped scene color through
`onUpdate`. Conversion and gamut handling reuse OpenPencil's culori-backed core color APIs.

## Slider presentation

`sliderPreview`, `sliderGradient`, `okhclSliderPreview`, and `okhclSliderGradient` provide the
colors and CSS gradients needed by slider skins. They contain presentation data only; keyboard,
pointer, and ARIA behavior belongs to the slider primitive.

## Update behavior

- RGB values use the `0–255` presentation range.
- HSL and HSB saturation/lightness/brightness use `0–100`.
- OkHCL lightness and alpha use `0–1`; chroma is non-negative; hue wraps into `0–360`.
- Alpha is preserved across color-space conversions.
- No-op updates do not call mutation callbacks.
- Editing hue on an achromatic color creates a visible color rather than remaining neutral.

## Related APIs

- [ColorPickerRoot](../components/color-picker-root)
- [ColorInputRoot](../components/color-input-root)
- [useFillControls](./use-fill-controls)
- [useStrokeControls](./use-stroke-controls)
