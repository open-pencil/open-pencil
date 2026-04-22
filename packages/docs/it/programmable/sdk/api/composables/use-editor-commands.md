---
title: useEditorCommands
description: Costruisci menu, azioni e UI guidata da comandi sopra l'editor.
---

# useEditorCommands

`useEditorCommands()` espone un livello orientato ai comandi sopra le azioni dell'editor.

È utile quando costruisci:

- menu dell'app
- menu contestuali
- toolbar
- adattatori per comandi da tastiera
- sottomenu per lo spostamento delle pagine

## Utilizzo

```ts
import { useEditorCommands } from '@open-pencil/vue'

const { commands, menuItem, runCommand, moveSelectionToPage, otherPages } = useEditorCommands()
```

## Esempio base

```ts
const { menuItem } = useEditorCommands()

const editMenu = [
  menuItem('edit.undo', '⌘Z'),
  menuItem('edit.redo', '⇧⌘Z'),
  { separator: true },
  menuItem('selection.delete'),
]
```

## Esempi pratici

### Esegui un comando direttamente

```ts
const { runCommand } = useEditorCommands()
runCommand('selection.duplicate')
```

### Costruisci un sottomenu "sposta alla pagina"

```ts
const { otherPages, moveSelectionToPage } = useEditorCommands()

const items = otherPages.value.map(page => ({
  label: page.name,
  action: () => moveSelectionToPage(page.id),
}))
```

## API correlate

- [useMenuModel](./use-menu-model)
- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)

## Tipi principali

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
