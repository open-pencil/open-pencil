---
title: useMenuModel
description: Создание моделей меню приложения и холста на основе текущего состояния редактора.
---

# useMenuModel

`useMenuModel()` создаёт готовые структуры меню на основе команд редактора и текущего выделения.

Используйте его, если компоненту меню удобнее получить уже сгруппированные пункты, чем собирать их из отдельных команд.

## Использование

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Базовый пример

```ts
const { canvasMenu } = useMenuModel()
```

Передайте `canvasMenu.value` своему компоненту контекстного меню.

## Практические примеры

### Главное меню приложения

`appMenu` группирует пункты в:

- Правка
- Вид
- Объект
- Расположение

### Контекстное меню с перемещением между страницами

`canvasMenu` включает динамические пункты, например «Переместить на страницу», исходя из текущего выделения и доступных страниц.

### Метки выделения

`selectionLabelMenu` предоставляет контекстно-зависимые метки:

- `Скрыть` / `Показать`
- `Заблокировать` / `Разблокировать`

## Связанные API

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
