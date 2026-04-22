---
title: useEditorCommands
description: Создание меню, действий и командного UI поверх редактора.
---

# useEditorCommands

`useEditorCommands()` предоставляет командно-ориентированный слой поверх действий редактора.

Полезен при создании:

- меню приложения
- контекстных меню
- тулбаров
- адаптеров клавиатурных команд
- подменю перемещения между страницами

## Использование

```ts
import { useEditorCommands } from '@open-pencil/vue'

const { commands, menuItem, runCommand, moveSelectionToPage, otherPages } = useEditorCommands()
```

## Базовый пример

```ts
const { menuItem } = useEditorCommands()

const editMenu = [
  menuItem('edit.undo', '⌘Z'),
  menuItem('edit.redo', '⇧⌘Z'),
  { separator: true },
  menuItem('selection.delete'),
]
```

## Практические примеры

### Запустить команду напрямую

```ts
const { runCommand } = useEditorCommands()
runCommand('selection.duplicate')
```

### Создать подменю «переместить на страницу»

```ts
const { otherPages, moveSelectionToPage } = useEditorCommands()

const items = otherPages.value.map(page => ({
  label: page.name,
  action: () => moveSelectionToPage(page.id),
}))
```

## Связанные API

- [useMenuModel](./use-menu-model)
- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)

## Основные типы

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
