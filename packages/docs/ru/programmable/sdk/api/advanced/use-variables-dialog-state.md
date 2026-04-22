---
title: useVariablesDialogState
description: Управление состоянием редактирования диалога переменных поверх useVariables().
---

# useVariablesDialogState

`useVariablesDialogState()` строится на `useVariables()` и добавляет специфичное для диалога состояние редактирования для переименования коллекций и управления фокусом.

Используйте его при создании кастомного диалога переменных, а не только потреблении комбинированного хелпера `useVariablesEditor()`.

## Использование

```ts
import { useVariablesDialogState } from '@open-pencil/vue'

const variablesDialog = useVariablesDialogState()
```

## Добавляет к useVariables()

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## Связанные API

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
