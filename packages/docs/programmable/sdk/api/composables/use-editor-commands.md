---
title: useEditorCommands
description: Build menus, actions, and command-driven UI on top of the editor.
---

# useEditorCommands

`useEditorCommands()` exposes a command-oriented layer over editor actions.

It is useful when building:

- app menus
- context menus
- toolbars
- keyboard-command adapters
- page-move submenus

## Usage

```ts
import { useEditorCommands } from '@inkly/vue'

const { commands, menuItem, runCommand, moveSelectionToPage, otherPages } = useEditorCommands()
```

## Basic example

```ts
const { menuItem } = useEditorCommands()

const editMenu = [
  menuItem('edit.undo', '⌘Z'),
  menuItem('edit.redo', '⇧⌘Z'),
  { separator: true },
  menuItem('selection.delete'),
]
```

## Practical examples

### Run a command directly

```ts
const { runCommand } = useEditorCommands()
runCommand('selection.duplicate')
```

### Build a “move to page” submenu

```ts
const { otherPages, moveSelectionToPage } = useEditorCommands()

const items = otherPages.value.map(page => ({
  label: page.name,
  action: () => moveSelectionToPage(page.id),
}))
```

## Related APIs

- [useMenuModel](./use-menu-model)
- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)

## Main types

```ts
type EditorCommandId =
  | 'edit.undo'
  | 'edit.redo'
  | 'selection.selectAll'
  | 'selection.duplicate'
  | 'selection.delete'
  | 'selection.group'
  | 'selection.ungroup'
  | 'selection.createComponent'
  | 'selection.createComponentSet'
  | 'selection.createInstance'
  | 'selection.detachInstance'
  | 'selection.goToMainComponent'
  | 'selection.wrapInAutoLayout'
  | 'selection.bringToFront'
  | 'selection.sendToBack'
  | 'selection.toggleVisibility'
  | 'selection.toggleLock'
  | 'selection.moveToPage'
  | 'view.zoom100'
  | 'view.zoomFit'
  | 'view.zoomSelection'
```
