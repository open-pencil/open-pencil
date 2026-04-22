---
title: useExport
description: Gestiona la configuración de exportación como escala y formato para la selección actual.
---

# useExport

`useExport()` es el composable del panel de exportación para los nodos seleccionados.

Gestiona:

- filas de configuración de exportación
- ids de nodos seleccionados
- etiquetado del nombre de exportación
- escalas y formatos soportados

## Uso

```ts
import { useExport } from '@open-pencil/vue'

const exportState = useExport()
```

## Ejemplo básico

```ts
const {
  settings,
  nodeName,
  scales,
  formats,
  addSetting,
  updateScale,
  updateFormat,
} = useExport()
```

## Ejemplos prácticos

### Añadir otro preset de exportación

```ts
exportState.addSetting()
```

### Cambiar la primera exportación a 2x WEBP

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## APIs relacionadas

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
