---
title: useColorVariableBinding
description: Helper de vinculación de variables para editores de color de relleno y trazo.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` expone helpers de búsqueda, vinculación y desvinculación para las variables de color usadas por los editores de relleno y trazo.

Úsalo cuando construyas interfaces de color que necesiten conectar rellenos o trazos a variables de diseño.

## Uso

```ts
import { useColorVariableBinding } from '@open-pencil/vue'

const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## APIs relacionadas

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [FillPickerRoot](../components/fill-picker-root)
