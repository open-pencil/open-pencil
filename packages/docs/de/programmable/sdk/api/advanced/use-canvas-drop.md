---
title: useCanvasDrop
description: Drag and drop von Image files auf den Canvas verarbeiten.
---

# useCanvasDrop

`useCanvasDrop(canvasRef, editor)` verbindet die Events `dragenter`, `dragover`, `dragleave` und `drop` mit dem Canvas. Unterstützte Image files werden an der passenden Position in das Dokument eingefügt.

Das composable in einem eigenen Canvas component verwenden, wenn Images per Drag and drop importiert werden sollen.

## Siehe auch

- [CanvasRoot](../components/canvas-root)
- [CanvasSurface](../components/canvas-surface)
- [extractImageFilesFromClipboard](./extract-image-files-from-clipboard)
