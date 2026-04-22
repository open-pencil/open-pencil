---
title: useVariablesDialogState
description: Gère l'état d'édition du dialogue de variables au-dessus de useVariables().
---

# useVariablesDialogState

`useVariablesDialogState()` s'appuie sur `useVariables()` et ajoute un état d'édition spécifique au dialogue pour le renommage des collections et la gestion du focus.

Utilisez-le quand vous construisez un dialogue de variables personnalisé plutôt que d'utiliser uniquement le helper combiné `useVariablesEditor()`.

## Utilisation

```ts
import { useVariablesDialogState } from '@open-pencil/vue'

const variablesDialog = useVariablesDialogState()
```

## Ajoute à useVariables()

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## API associées

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
