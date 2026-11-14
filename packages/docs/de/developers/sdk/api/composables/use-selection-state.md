---
title: useSelectionState
description: Reaktiver Zustand der aktuellen Auswahl, des Hauptobjekts und seines Typs.
---

# useSelectionState

`useSelectionState()` liefert Angaben über vorhandene und ausgewählte Objekte, das Hauptobjekt und darüber, ob es eine Instanz, Komponente oder Gruppe ist.

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

## Siehe auch

- [useSelectionCapabilities](./use-selection-capabilities)
- [useEditorCommands](./use-editor-commands)
