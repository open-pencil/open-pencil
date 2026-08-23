---
title: useEditorCommands
description: Menüs und andere UI auf Grundlage gemeinsamer Editor commands erstellen.
---

# useEditorCommands

`useEditorCommands()` stellt einen gemeinsamen Zugang zu Editor commands bereit.

Das composable eignet sich für:

- Application menus;
- Kontextmenüs;
- Toolbars;
- Shortcut handling;
- das Submenu Move to page.

## Verwendung

```ts
import { useEditorCommands } from '@open-pencil/vue'

const { commands, menuItem, runCommand, moveSelectionToPage, otherPages } = useEditorCommands()
```

## Beispiel

```ts
const { menuItem } = useEditorCommands()

const editMenu = [
  menuItem('edit.undo', '⌘Z'),
  menuItem('edit.redo', '⇧⌘Z'),
  { separator: true },
  menuItem('selection.delete'),
]
```

### Command direkt ausführen

```ts
const { runCommand } = useEditorCommands()
runCommand('selection.duplicate')
```

### Submenu Move to page

```ts
const { otherPages, moveSelectionToPage } = useEditorCommands()

const items = otherPages.value.map(page => ({
  label: page.name,
  action: () => moveSelectionToPage(page.id),
}))
```

## Siehe auch

- [useMenuModel](./use-menu-model)
- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)

## Zentrale Types

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
