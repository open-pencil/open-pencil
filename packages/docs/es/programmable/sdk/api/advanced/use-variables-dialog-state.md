---
title: useVariablesDialogState
description: Gestiona el estado de edición del diálogo de variables sobre useVariables().
---

# useVariablesDialogState

`useVariablesDialogState()` se construye sobre `useVariables()` y añade el estado de edición específico del diálogo para el renombrado de colecciones y la gestión del foco.

Úsalo cuando estés construyendo un diálogo de variables personalizado en lugar de consumir solo el helper combinado `useVariablesEditor()`.

## Uso

```ts
import { useVariablesDialogState } from '@open-pencil/vue'

const variablesDialog = useVariablesDialogState()
```

## Añade a useVariables()

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## APIs relacionadas

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
