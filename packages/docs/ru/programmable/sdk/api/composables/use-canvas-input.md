---
title: useCanvasInput
description: Подключение ввода указателя, перетаскивания, выделения, изменения размера, поворота и инструментов к холсту.
---

# useCanvasInput

`useCanvasInput()` подключает взаимодействия указателя и мыши к холсту редактора.

Обрабатывает:

- выделение
- перетаскивание
- изменение размера
- поворот
- прокрутку (panning)
- потоки рисования пером
- взаимодействие при редактировании текста
- хит-тестирование с учётом области видимости

## Использование

Этот компосабл обычно используется вместе с `useCanvas()` и хелперами хит-тестирования от рендерера.

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
)
```

## Базовый пример

```ts
const canvas = useCanvas(canvasRef, editor)

useCanvasInput(
  canvasRef,
  editor,
  canvas.hitTestSectionTitle,
  canvas.hitTestComponentLabel,
  canvas.hitTestFrameTitle,
)
```

## Практические примеры

### Отслеживание движения курсора в пространстве холста

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  (cx, cy) => {
    console.log(cx, cy)
  },
)
```

## Примечания

Этот компосабл более низкоуровневый, чем большинство логики панелей. Лучше всего подходит для оболочек редактора и контейнеров холста.

## Связанные API

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
