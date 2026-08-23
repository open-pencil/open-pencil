---
title: useTextEdit
description: Obsługa wejścia tekstowego DOM, IME, formatowania i synchronizacji obiektów tekstowych.
---

# useTextEdit

`useTextEdit()` łączy wejście DOM z edycją tekstu na obszarze roboczym. Zarządza `textarea`, IME, kursorem, Delete/Backspace, poleceniami pogrubienia, kursywy i podkreślenia oraz zapisem zmian w SceneGraph.

```ts
useTextEdit(canvasRef, editor)
```

Użyj go w komponencie zawierającym obszar roboczy, zwykle razem z `useCanvas()` i `useCanvasInput()`.

## Zobacz też

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
