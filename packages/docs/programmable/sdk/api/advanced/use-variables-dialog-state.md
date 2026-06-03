---
title: useVariablesDialogState
description: Manage variables dialog editing state on top of useVariables().
---

# useVariablesDialogState

`useVariablesDialogState()` builds on `useVariables()` and adds dialog-specific editing state for collection renaming and focus management.

Use it when you are building a custom variables dialog rather than only consuming the combined `useVariablesEditor()` helper.

## Usage

```ts
import { useVariablesDialogState } from '@inkly/vue'

const variablesDialog = useVariablesDialogState()
```

## Adds to useVariables()

- `editingCollectionId`
- `setCollectionInputRef()`
- `startRenameCollection()`
- `commitRenameCollection()`

## Related APIs

- [useVariables](./use-variables)
- [useVariablesEditor](../composables/use-variables-editor)
