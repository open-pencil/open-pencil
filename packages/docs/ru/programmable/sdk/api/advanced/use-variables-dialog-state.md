---
title: useVariablesDialogState
description: Состояние редактирования диалога переменных на основе useVariables().
---

# useVariablesDialogState

`useVariablesDialogState()` дополняет `useVariables()` состоянием для переименования коллекции и управления фокусом в диалоге переменных.

Используйте composable для собственного диалога вместо готового объединения `useVariablesEditor()`.

```ts
const variablesDialog = useVariablesDialogState()
```

Дополнительные значения и функции:

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## См. также

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
