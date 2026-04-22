---
title: useVariablesDialogState
description: Variablen-Dialog-Bearbeitungszustand auf Basis von useVariables() verwalten.
---

# useVariablesDialogState

`useVariablesDialogState()` baut auf `useVariables()` auf und fügt dialog-spezifischen Bearbeitungszustand für Sammlungsumbenennungen und Fokusverwaltung hinzu.

Verwenden Sie es, wenn Sie einen benutzerdefinierten Variablen-Dialog erstellen, anstatt nur das kombinierte `useVariablesEditor()`-Hilfsmittel zu verwenden.

## Verwendung

```ts
import { useVariablesDialogState } from '@open-pencil/vue'

const variablesDialog = useVariablesDialogState()
```

## Ergänzungen zu useVariables()

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## Verwandte APIs

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
