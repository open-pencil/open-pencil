---
title: useCanvas
description: Creare e mantenere la superficie CanvasKit dell’editor.
---

# useCanvas

`useCanvas(options)` collega un elemento `<canvas>` al motore di rendering. Carica CanvasKit, crea e ricrea la superficie, osserva le dimensioni, adatta la scala dei pixel, richiede ridisegni e libera le risorse.

Usa `CanvasRoot` e `CanvasSurface` per la composizione normale, o questo composable per il controllo diretto.

## Vedi anche

- [CanvasRoot](../components/canvas-root)
- [CanvasSurface](../components/canvas-surface)
- [useCanvasInput](./use-canvas-input)
