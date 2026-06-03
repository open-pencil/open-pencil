---
title: useVariablesTable
description: Build TanStack Table column definitions for Inkly variables UIs.
---

# useVariablesTable

`useVariablesTable(options)` returns reactive TanStack Table column definitions for variables editors.

Use it when you want the SDK's variable-table behavior but need to supply your own table instance, custom icons, or app-specific shell components.

## Usage

```ts
import { useVariablesTable } from '@inkly/vue'

const { columns } = useVariablesTable(options)
```

## Notes

- this is a specialized integration helper for table-driven variables UIs
- most consumers should start with `useVariablesEditor()` unless they need finer control

## Related APIs

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
