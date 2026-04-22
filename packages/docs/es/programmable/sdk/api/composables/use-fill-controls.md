---
title: useFillControls
description: Composable del panel de rellenos con comportamiento de relleno por defecto.
---

# useFillControls

`useFillControls()` es el composable de propiedades de relleno usado por las interfaces de edición de rellenos.

Añade un valor de relleno por defecto reutilizable.

## Uso

```ts
import { useFillControls } from '@open-pencil/vue'

const fills = useFillControls()
```

## Qué te ofrece

Expone:

- `defaultFill`

## Ejemplos prácticos

### Añadir una nueva fila de relleno

```ts
propertyList.add(fills.defaultFill)
```

## APIs relacionadas

- [PropertyListRoot](../components/property-list-root)
