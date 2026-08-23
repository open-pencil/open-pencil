---
title: useVariablesDialogState
description: Stan zmiany nazw kolekcji i zarządzania fokusem w oknie zmiennych.
---

# useVariablesDialogState

`useVariablesDialogState()` rozszerza `useVariables()` o stan potrzebny do zmiany nazwy kolekcji i zarządzania fokusem.

Użyj composable do zbudowania własnego okna zamiast pełnej integracji `useVariablesEditor()`.

```ts
const variablesDialog = useVariablesDialogState()
```

Dodatkowe wartości i funkcje:

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## Zobacz też

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
