---
title: useVariables
description: Read and mutate variable collections, variables, and variable values.
---

# useVariables

`useVariables()` is the lower-level variables composable behind the higher-level variables editor helpers.

Use it when you want direct control over collections, active modes, filtering, and CRUD operations without taking the full table/dialog abstraction.

## Usage

```ts
import { useVariables } from '@inkly/vue'

const variables = useVariables()
```

## Returns

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

## Related APIs

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
