---
title: useVariables
description: Variablensammlungen, Variablen und Variablenwerte lesen und verändern.
---

# useVariables

`useVariables()` ist das Niedrigstufen-Variablen-Composable hinter den übergeordneten Variablen-Editor-Hilfsmitteln.

Verwenden Sie es, wenn Sie direkte Kontrolle über Sammlungen, aktive Modi, Filterung und CRUD-Operationen ohne die vollständige Tabellen-/Dialog-Abstraktion möchten.

## Verwendung

```ts
import { useVariables } from '@open-pencil/vue'

const variables = useVariables()
```

## Rückgabewerte

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

## Verwandte APIs

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
