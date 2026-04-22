---
title: useVariablesTable
description: Создание определений колонок TanStack Table для UI переменных OpenPencil.
---

# useVariablesTable

`useVariablesTable(options)` возвращает реактивные определения колонок TanStack Table для редакторов переменных.

Используйте его, когда нужно поведение таблицы переменных от SDK, но вы хотите предоставить собственный экземпляр таблицы, кастомные иконки или компоненты оболочки приложения.

## Использование

```ts
import { useVariablesTable } from '@open-pencil/vue'

const { columns } = useVariablesTable(options)
```

## Примечания

- это специализированный хелпер интеграции для UI переменных на основе таблиц
- большинству потребителей следует начать с `useVariablesEditor()`, если не нужен более тонкий контроль

## Связанные API

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
