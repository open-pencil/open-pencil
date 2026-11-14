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
- перемещение видимой области холста;
- рисование с помощью Pen tool;
- взаимодействие в режиме редактирования текста;
- hit testing с учётом текущей видимой области.

## Использование

Обычно этот composable используют вместе с `useCanvas()` и функциями hit testing, которые предоставляет renderer.

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

Этот composable относится к низкоуровневому API. Он предназначен прежде всего для компонентов, в которых размещён холст, и для собственных интерфейсов редактора.

## Связанные API

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
