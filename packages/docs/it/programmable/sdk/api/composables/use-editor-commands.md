---
title: useEditorCommands
description: Creare Menu e altre interfacce dalle Commands comuni dell’Editor.
---

# useEditorCommands

`useEditorCommands()` fornisce un accesso comune alle Editor commands per Application menus, Menu contestuali, Toolbars, scorciatoie e Submenu Move to page.

```ts
const { commands, menuItem, runCommand, moveSelectionToPage, otherPages } = useEditorCommands()

runCommand('selection.duplicate')

const items = otherPages.value.map(page => ({
  label: page.name,
  action: () => moveSelectionToPage(page.id),
}))
```

## Vedi anche

- [useMenuModel](./use-menu-model)
- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
