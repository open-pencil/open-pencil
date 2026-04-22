---
title: useVariables
description: Чтение и изменение коллекций переменных, переменных и их значений.
---

# useVariables

`useVariables()` — низкоуровневый компосабл переменных, лежащий в основе высокоуровневых хелперов редактора переменных.

Используйте его, когда нужен прямой контроль над коллекциями, активными режимами, фильтрацией и CRUD-операциями без полной абстракции таблицы/диалога.

## Использование

```ts
import { useVariables } from '@open-pencil/vue'

const variables = useVariables()
```

## Возвращает

- `collections`
- `activeCollectionId`
- `activeCollection`
- `activeModes`
- `variables`
- `searchTerm`
- `setSearchTerm()`
- `setActiveCollection()`
- `addCollection()`
- `renameCollection()`
- `addVariable()`
- `removeVariable()`
- `renameVariable()`
- `updateVariableValue()`
- `formatModeValue()`
- `parseVariableValue()`
- `shortName()`

## Связанные API

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
