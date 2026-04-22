---
title: useOkHCL
description: Pracuj z modelami kolorów RGBA i OkHCL dla wypełnień i obrysów.
---

# useOkHCL

`useOkHCL()` udostępnia pomocniki do odczytywania, włączania, wyłączania i aktualizowania wartości kolorów OkHCL na wypełnieniach i obrysach węzłów.

Użyj go, gdy budujesz zaawansowane narzędzia kolorów, które muszą przełączać się między standardową edycją RGBA a percepcyjną edycją OkHCL.

## Użycie

```ts
import { useOkHCL } from '@open-pencil/vue'

const okhcl = useOkHCL()
```

## Zwraca

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

## Powiązane API

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
