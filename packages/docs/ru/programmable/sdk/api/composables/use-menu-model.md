---
title: useMenuModel
description: Создание моделей меню приложения и холста на основе текущего состояния редактора.
---

# useMenuModel

`useMenuModel()` строит высокоуровневые структуры меню поверх команд редактора и состояния выделения.

Полезен, когда нужны готовые к рендерингу группы меню вместо ручной компоновки команд.

## Использование

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Базовый пример

```ts
const { canvasMenu } = useMenuModel()
```

Рендерите `canvasMenu.value` в ваш компонент контекстного меню.

## Практические примеры

### Верхнее меню в стиле приложения

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
