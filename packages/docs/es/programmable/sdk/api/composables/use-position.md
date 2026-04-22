---
title: usePosition
description: Lee y actualiza la posición, el tamaño, la rotación, la alineación y el volteo de los nodos seleccionados.
---

# usePosition

`usePosition()` es un composable de control para la UI relacionada con la posición.

Expone valores de los nodos seleccionados como:

- `x`
- `y`
- `width`
- `height`
- `rotation`

y acciones como:

- alinear
- voltear
- rotar
- arrastrar/actualizar propiedades numéricas

## Uso

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Ejemplo básico

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Ejemplos prácticos

### Alinear nodos seleccionados

```ts
position.align('horizontal', 'center')
position.align('vertical', 'min')
```

### Voltear la selección

```ts
position.flip('horizontal')
position.flip('vertical')
```

### Rotar la selección

```ts
position.rotate(90)
```

## APIs relacionadas

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
