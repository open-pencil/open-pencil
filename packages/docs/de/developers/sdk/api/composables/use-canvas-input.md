---
title: useCanvasInput
description: Zeigereingabe, Ziehen, Auswahl, Größenänderung, Drehung und Werkzeuge mit der Arbeitsfläche verbinden.
---

# useCanvasInput

`useCanvasInput()` verbindet Zeiger- und Mausereignisse mit der Arbeitsfläche des Editors.

Es behandelt Auswahl, Ziehen, Größenänderung, Drehung, Verschieben der Ansicht, Zeichnen mit dem Zeichenstift, Textbearbeitung und Trefferprüfung unter Berücksichtigung der Ansicht.

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
)
```

## Siehe auch

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
