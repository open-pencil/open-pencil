---
title: useTextEdit
description: DOM-Texteingabe, IME, Formatierung und Synchronisierung von Textobjekten verwalten.
---

# useTextEdit

`useTextEdit()` verbindet die DOM-Eingabe mit der Textbearbeitung auf der Arbeitsfläche. Es verwaltet `textarea`, IME, Cursor, Löschen, Formatierungsbefehle und das Schreiben der Änderungen in SceneGraph.

```ts
useTextEdit(canvasRef, editor)
```

Verwenden Sie es in der Komponente, die die Arbeitsfläche enthält, gewöhnlich zusammen mit `useCanvas()` und `useCanvasInput()`.

## Siehe auch

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
