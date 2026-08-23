---
title: useVariables
description: Чтение и изменение коллекций, переменных, режимов и значений.
---

# useVariables

`useVariables()` предоставляет низкоуровневое состояние и действия редактора переменных.

Используйте composable для прямого управления коллекциями, активными режимами, фильтрами и операциями создания, чтения, обновления и удаления без готовых таблицы или диалога.

```ts
const variables = useVariables()
```

Среди возвращаемых значений — `collections`, `activeCollection`, `activeModes`, `variables`, `searchTerm` и действия для создания, переименования, удаления и обновления переменных и коллекций.

## См. также

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
