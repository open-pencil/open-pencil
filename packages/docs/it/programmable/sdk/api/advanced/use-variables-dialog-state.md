---
title: useVariablesDialogState
description: Stato per rinominare collezioni e gestire il focus nella finestra delle variabili.
---

# useVariablesDialogState

`useVariablesDialogState()` estende `useVariables()` con lo stato necessario per rinominare una collezione e gestire il focus.

Usalo per creare una finestra personalizzata invece dell’integrazione completa `useVariablesEditor()`.

```ts
const variablesDialog = useVariablesDialogState()
```

API aggiuntive:

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## Vedi anche

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
