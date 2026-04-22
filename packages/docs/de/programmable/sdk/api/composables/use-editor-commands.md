---
title: useEditorCommands
description: Menüs, Aktionen und befehlsgesteuerte UI auf Basis des Editors erstellen.
---

# useEditorCommands

`useEditorCommands()` legt eine befehlsorientierte Schicht über Editor-Aktionen.

Es ist nützlich beim Erstellen von:

- App-Menüs
- Kontextmenüs
- Toolbars
- Tastaturbefehl-Adaptern
- Seiten-Verschiebe-Untermenüs

## Verwendung

```ts
import { useEditorCommands } from '@open-pencil/vue'

const { commands, menuItem, runCommand, moveSelectionToPage, otherPages } = useEditorCommands()
```

## Einfaches Beispiel

```ts
const { menuItem } = useEditorCommands()

const editMenu = [
  menuItem('edit.undo', '⌘Z'),
  menuItem('edit.redo', '⇧⌘Z'),
  { separator: true },
  menuItem('selection.delete'),
]
```

## Praktische Beispiele

### Einen Befehl direkt ausführen

```ts
const { runCommand } = useEditorCommands()
runCommand('selection.duplicate')
```

### Ein „Auf Seite verschieben"-Untermenü erstellen

```ts
const { otherPages, moveSelectionToPage } = useEditorCommands()

const items = otherPages.value.map(page => ({
  label: page.name,
  action: () => moveSelectionToPage(page.id),
}))
```

## Verwandte APIs

- [useMenuModel](./use-menu-model)
- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)

## Wichtigste Typen

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
