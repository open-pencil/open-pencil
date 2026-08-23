---
title: useEditor
description: Auf die mit provideEditor bereitgestellte OpenPencil-Editorinstanz zugreifen.
---

# useEditor

`useEditor()` gibt die Editorinstanz aus dem nächsten `provideEditor()`-Kontext zurück.

Composables und Komponenten ohne vorgegebenes Erscheinungsbild verwenden diese Funktion als zentralen Zugang zum Editor.

```ts
const editor = useEditor()
const selected = editor.getSelectedNodes()
editor.zoomToFit()
editor.undoAction()
```

Außerhalb eines gültigen Provider-Baums löst die Funktion einen verständlichen Fehler aus.

## Siehe auch

- [provideEditor](./provide-editor)
- [useCanvas](./use-canvas)
- [useSelectionState](./use-selection-state)
