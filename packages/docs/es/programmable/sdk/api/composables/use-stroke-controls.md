---
title: useStrokeControls
description: Helpers del panel de trazos para alineación, selección de lado y pesos de trazo por lado.
---

# useStrokeControls

`useStrokeControls()` es el composable de propiedades de trazo usado por los paneles de edición de trazos.

Proporciona:

- opciones de alineación del trazo
- presets de lado como todos, superior, inferior, izquierda, derecha, personalizado
- datos de trazo por defecto
- helpers para los pesos de borde por lado

## Uso

```ts
import { useStrokeControls } from '@open-pencil/vue'

const strokes = useStrokeControls()
```

## Ejemplo básico

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
```

## Ejemplos prácticos

### Establecer la alineación del trazo

```ts
strokes.updateAlign('INSIDE', activeNode)
```

### Limitar un trazo a un solo lado

```ts
strokes.selectSide('TOP', activeNode)
```

## APIs relacionadas

- [PropertyListRoot](../components/property-list-root)
