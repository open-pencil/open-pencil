---
title: useOkHCL
description: Lavora con i modelli di colore RGBA e OkHCL per riempimenti e tratti.
---

# useOkHCL

`useOkHCL()` espone helper per leggere, abilitare, disabilitare e aggiornare i valori di colore OkHCL sui riempimenti e tratti dei nodi.

Usalo quando stai costruendo strumenti colore avanzati che devono passare tra la modifica RGBA standard e la modifica percettiva OkHCL.

## Utilizzo

```ts
import { useOkHCL } from '@open-pencil/vue'

const okhcl = useOkHCL()
```

## Restituisce

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

## API correlate

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
