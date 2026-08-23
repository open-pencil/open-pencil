---
title: useVariablesEditor
description: Подготовка состояния диалога переменных и таблицы TanStack Table.
---

# useVariablesEditor

`useVariablesEditor()` объединяет всё необходимое для создания диалога или отдельного экрана редактирования переменных:

- состояние диалога;
- столбцы таблицы;
- подключение TanStack Vue Table;
- функции для работы с коллекциями и modes.

## Использование

```ts
const variables = useVariablesEditor({
  colorInput: ColorInput,
  icons,
  fallbackIcon,
  deleteIcon,
})
```

## Возвращает

Возвращаемое значение содержит состояние диалога и таблицы, а также:

- `columns`
- `table`
- `hasCollections`

## Практические примеры

### Создать диалог переменных

Используйте `useVariablesEditor()`, если нужен единый composable с уже подключённой таблицей и обработчиками действий.

## Связанные API

- [Обзор SDK API](../)
