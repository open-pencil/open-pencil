---
title: useVariablesTable
description: Определения столбцов TanStack Table для редактора переменных.
---

# useVariablesTable

`useVariablesTable(options)` возвращает реактивные определения столбцов таблицы переменных.

Используйте composable, если нужно поведение SDK, но экземпляр таблицы, значки или компоненты предоставляет приложение.

```ts
const { columns } = useVariablesTable(options)
```

Для большинства приложений проще начать с `useVariablesEditor()`. `useVariablesTable()` предоставляет прямой контроль над настройкой таблицы.

## См. также

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
