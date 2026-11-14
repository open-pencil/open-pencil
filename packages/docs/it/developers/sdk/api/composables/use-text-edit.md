---
title: useTextEdit
description: Gestire DOM text input, IME, Formatting e sincronizzazione degli oggetti di testo.
---

# useTextEdit

`useTextEdit()` collega il DOM input all’editing del testo nel canvas dell’Editor. Gestisce `textarea`, IME, Caret, Delete/Backspace, Commands Bold/Italic/Underline e scrittura delle modifiche in SceneGraph.

```ts
useTextEdit(canvasRef, editor)
```

Usalo nel Component che contiene il canvas, normalmente insieme a `useCanvas()` e `useCanvasInput()`.

Durante l’input, la Function aggiorna testo e Style runs in SceneGraph.

## Vedi anche

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
