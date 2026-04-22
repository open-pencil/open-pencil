---
title: useVariables
description: Odczytuj i mutuj kolekcje zmiennych, zmienne i wartości zmiennych.
---

# useVariables

`useVariables()` to niskopoziomowy kompozyt zmiennych za wyższopoziomowymi pomocnikami edytora zmiennych.

Użyj go, gdy chcesz bezpośrednią kontrolę nad kolekcjami, aktywnymi trybami, filtrowaniem i operacjami CRUD bez przyjmowania pełnej abstrakcji tabeli/okna dialogowego.

## Użycie

```ts
import { useVariables } from '@open-pencil/vue'

const variables = useVariables()
```

## Zwraca

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

## Powiązane API

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
