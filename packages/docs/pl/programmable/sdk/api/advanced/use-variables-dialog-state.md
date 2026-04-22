---
title: useVariablesDialogState
description: Zarządzaj stanem edycji okna dialogowego zmiennych na bazie useVariables().
---

# useVariablesDialogState

`useVariablesDialogState()` buduje na `useVariables()` i dodaje stan edycji specyficzny dla okna dialogowego do zmiany nazwy kolekcji i zarządzania fokusem.

Użyj go, gdy budujesz niestandardowe okno dialogowe zmiennych zamiast korzystać tylko z pomocnika `useVariablesEditor()`.

## Użycie

```ts
import { useVariablesDialogState } from '@open-pencil/vue'

const variablesDialog = useVariablesDialogState()
```

## Dodaje do useVariables()

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## Powiązane API

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
