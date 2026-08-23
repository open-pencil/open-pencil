---
title: useEditorCommands
description: Tworzenie menu i innych elementów interfejsu na podstawie poleceń edytora.
---

# useEditorCommands

`useEditorCommands()` udostępnia wspólny interfejs do wykonywania poleceń edytora.

Przydaje się podczas tworzenia:

- menu aplikacji;
- menu kontekstowych;
- pasków narzędzi;
- obsługi skrótów;
- podmenu przenoszenia na stronę.

## Użycie

```ts
import { useEditorCommands } from '@open-pencil/vue'

const { commands, menuItem, runCommand, moveSelectionToPage, otherPages } = useEditorCommands()
```

## Przykład

```ts
const { menuItem } = useEditorCommands()

const editMenu = [
  menuItem('edit.undo', '⌘Z'),
  menuItem('edit.redo', '⇧⌘Z'),
  { separator: true },
  menuItem('selection.delete'),
]
```

### Bezpośrednie wykonanie polecenia

```ts
const { runCommand } = useEditorCommands()
runCommand('selection.duplicate')
```

### Podmenu przenoszenia na stronę

```ts
const { otherPages, moveSelectionToPage } = useEditorCommands()

const items = otherPages.value.map(page => ({
  label: page.name,
  action: () => moveSelectionToPage(page.id),
}))
```

## Zobacz też

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
