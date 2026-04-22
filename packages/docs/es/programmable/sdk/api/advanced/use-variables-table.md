---
title: useVariablesTable
description: Construye definiciones de columnas de TanStack Table para interfaces de variables de OpenPencil.
---

# useVariablesTable

`useVariablesTable(options)` devuelve definiciones de columnas reactivas de TanStack Table para editores de variables.

Úsalo cuando quieras el comportamiento de tabla de variables del SDK pero necesites proporcionar tu propia instancia de tabla, iconos personalizados o componentes shell específicos de la app.

## Uso

```ts
import { useVariablesTable } from '@open-pencil/vue'

const { columns } = useVariablesTable(options)
```

## Notas

- este es un helper de integración especializado para interfaces de variables basadas en tabla
- la mayoría de los consumidores deben empezar con `useVariablesEditor()` a menos que necesiten un control más fino

## APIs relacionadas

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
