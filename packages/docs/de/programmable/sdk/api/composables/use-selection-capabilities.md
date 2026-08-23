---
title: useSelectionCapabilities
description: Reaktive Wahrheitswerte für die mit der aktuellen Auswahl verfügbaren Aktionen.
---

# useSelectionCapabilities

`useSelectionCapabilities()` gibt an, ob typische Editoraktionen verfügbar sind. Das Composable eignet sich für Menüs, Werkzeugleisten, Tastenkürzel, Schaltflächen und kontextabhängige Panels.

```ts
const {
  canDelete,
  canDuplicate,
  canCreateComponent,
  canMoveToPage,
  canGoToMainComponent,
  canZoomToSelection,
} = useSelectionCapabilities()
```

## Siehe auch

- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)
