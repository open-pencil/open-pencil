---
title: useSelectionState
description: State reattivo della Selection corrente, dell’oggetto principale e del relativo Type.
---

# useSelectionState

`useSelectionState()` fornisce informazioni reattive su presenza e numero degli oggetti selezionati, oggetto principale e relativo Type: Instance, Component o Group.

```ts
const {
  selectedIds,
  hasSelection,
  selectedNode,
  selectedCount,
  selectedNodeType,
  isInstance,
  isComponent,
  isGroup,
  canCreateComponentSet,
} = useSelectionState()
```

## Vedi anche

- [useSelectionCapabilities](./use-selection-capabilities)
- [useEditorCommands](./use-editor-commands)
- [useEditor](./use-editor)
