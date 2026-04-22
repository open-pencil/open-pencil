---
title: useEditorCommands
description: Buduj menu, akcje i UI napędzany poleceniami na bazie edytora.
---

# useEditorCommands

`useEditorCommands()` udostępnia warstwę zorientowaną na polecenia nad akcjami edytora.

Przydatny przy budowaniu:

- menu aplikacji
- menu kontekstowych
- pasków narzędzi
- adapterów poleceń klawiaturowych
- podmenu przenoszenia stron

## Użycie

```ts
import { useEditorCommands } from '@open-pencil/vue'

const { commands, menuItem, runCommand, moveSelectionToPage, otherPages } = useEditorCommands()
```

## Podstawowy przykład

```ts
const { menuItem } = useEditorCommands()

const editMenu = [
  menuItem('edit.undo', '⌘Z'),
  menuItem('edit.redo', '⇧⌘Z'),
  { separator: true },
  menuItem('selection.delete'),
]
```

## Przykłady praktyczne

### Uruchom polecenie bezpośrednio

```ts
const { runCommand } = useEditorCommands()
runCommand('selection.duplicate')
```

### Zbuduj podmenu "przenieś na stronę"

```ts
const { otherPages, moveSelectionToPage } = useEditorCommands()

const items = otherPages.value.map(page => ({
  label: page.name,
  action: () => moveSelectionToPage(page.id),
}))
```

## Powiązane API

- [useMenuModel](./use-menu-model)
- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)

## Główne typy

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
