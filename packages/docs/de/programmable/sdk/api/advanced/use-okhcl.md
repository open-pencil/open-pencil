---
title: useOkHCL
description: Mit RGBA- und OkHCL-Farbmodellen für Füllungen und Konturen arbeiten.
---

# useOkHCL

`useOkHCL()` gibt Hilfsmittel zum Lesen, Aktivieren, Deaktivieren und Aktualisieren von OkHCL-Farbwerten auf Knoten-Füllungen und -Konturen zurück.

Verwenden Sie es, wenn Sie fortgeschrittene Farbwerkzeuge erstellen, die zwischen Standard-RGBA-Bearbeitung und wahrnehmungsbasierter OkHCL-Bearbeitung wechseln müssen.

## Verwendung

```ts
import { useOkHCL } from '@open-pencil/vue'

const okhcl = useOkHCL()
```

## Rückgabewerte

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

## Verwandte APIs

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
