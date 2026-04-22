---
title: useVariables
description: Leggi e modifica collezioni di variabili, variabili e valori delle variabili.
---

# useVariables

`useVariables()` è il composable variabili di livello inferiore alla base degli helper dell'editor di variabili di livello superiore.

Usalo quando vuoi controllo diretto su collezioni, modalità attive, filtraggio e operazioni CRUD senza prendere l'astrazione completa di tabella/dialogo.

## Utilizzo

```ts
import { useVariables } from '@open-pencil/vue'

const variables = useVariables()
```

## Restituisce

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

## API correlate

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
