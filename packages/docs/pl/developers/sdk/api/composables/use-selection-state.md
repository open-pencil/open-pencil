---
title: useSelectionState
description: Reaktywny stan bieżącego zaznaczenia, głównego obiektu i jego typu.
---

# useSelectionState

`useSelectionState()` udostępnia informacje o obecności i liczbie zaznaczonych obiektów, obiekcie głównym oraz o tym, czy jest on egzemplarzem, komponentem albo grupą.

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

## Zobacz też

- [useSelectionCapabilities](./use-selection-capabilities)
- [useEditorCommands](./use-editor-commands)
- [useEditor](./use-editor)
