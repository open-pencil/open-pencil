---
title: useVariables
description: Lit et modifie les collections de variables, les variables et les valeurs de variables.
---

# useVariables

`useVariables()` est le composable de variables de bas niveau derrière les helpers d'éditeur de variables de plus haut niveau.

Utilisez-le quand vous voulez un contrôle direct sur les collections, les modes actifs, le filtrage et les opérations CRUD sans prendre l'abstraction complète de tableau/dialogue.

## Utilisation

```ts
import { useVariables } from '@open-pencil/vue'

const variables = useVariables()
```

## Retourne

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

## API associées

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
