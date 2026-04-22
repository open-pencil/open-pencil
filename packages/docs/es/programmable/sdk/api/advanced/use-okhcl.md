---
title: useOkHCL
description: Trabaja con los modelos de color RGBA y OkHCL para rellenos y trazos.
---

# useOkHCL

`useOkHCL()` expone helpers para leer, habilitar, deshabilitar y actualizar valores de color OkHCL en los rellenos y trazos de los nodos.

Úsalo cuando construyas herramientas de color avanzadas que necesiten alternar entre la edición RGBA estándar y la edición perceptual OkHCL.

## Uso

```ts
import { useOkHCL } from '@open-pencil/vue'

const okhcl = useOkHCL()
```

## Devuelve

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

## APIs relacionadas

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
