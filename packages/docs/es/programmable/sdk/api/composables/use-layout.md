---
title: useLayout
description: Trabaja con auto-layout, tamaño, relleno, alineación y pistas de cuadrícula.
---

# useLayout

`useLayout()` es el composable de control principal para los paneles relacionados con el layout.

Expone estado y acciones para:

- modo flex vs grid
- tamaño de ancho/alto
- relleno
- alineación
- edición de pistas de plantilla de cuadrícula

## Uso

```ts
import { useLayout } from '@open-pencil/vue'

const layout = useLayout()
```

## Ejemplo básico

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

## Ejemplos prácticos

### Alternar entre relleno uniforme e individual

```ts
layout.toggleIndividualPadding()
```

### Actualizar pistas de cuadrícula

```ts
layout.updateGridTrack('gridTemplateColumns', 0, { sizing: 'FIXED', value: 240 })
layout.addTrack('gridTemplateRows')
```

### Cambiar la alineación

```ts
layout.setAlignment('CENTER', 'MAX')
```

## APIs relacionadas

- [usePosition](./use-position)
- [useEditor](./use-editor)
