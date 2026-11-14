---
title: useSelectionCapabilities
description: Reaktywne wartości logiczne określające działania dostępne dla bieżącego zaznaczenia.
---

# useSelectionCapabilities

`useSelectionCapabilities()` zwraca wartości logiczne wskazujące, czy typowe działania edytora są dostępne. Nadaje się do menu, pasków narzędzi, skrótów, przycisków i paneli zależnych od kontekstu.

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

## Zobacz też

- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)
