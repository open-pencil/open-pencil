---
title: useVariablesDialogState
description: Gestisce lo stato di modifica del dialogo variabili sopra useVariables().
---

# useVariablesDialogState

`useVariablesDialogState()` si basa su `useVariables()` e aggiunge lo stato di modifica specifico del dialogo per la rinomina delle collezioni e la gestione del focus.

Usalo quando stai costruendo un dialogo variabili personalizzato invece di consumare solo il combinato `useVariablesEditor()`.

## Utilizzo

```ts
import { useVariablesDialogState } from '@open-pencil/vue'

const variablesDialog = useVariablesDialogState()
```

## Aggiunge a useVariables()

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## API correlate

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
