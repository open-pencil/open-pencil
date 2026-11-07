---
title: CanvasRoot
description: Headless canvas primitive for OpenPencil rendering surfaces.
---

# CanvasRoot

`CanvasRoot` is the structural canvas primitive in `@open-pencil/vue`.

Use it when you want SDK-provided canvas structure and context with app-owned layout and styling. It draws the page in the `CanvasSurface` inside it and takes that canvas's pointer input and typing: selecting, dragging, drawing with the active tool, panning and zooming, and editing paths and text.

```vue
<CanvasRoot :show-rulers="false" @ready="start" @failed="showError">
  <CanvasSurface class="size-full" />
</CanvasRoot>
```

- `input`: takes pointer input and typing; `false` makes a canvas that only draws. Read once; default `true`.
- `showRulers`: shows or hides the rulers.
- `preserveDrawingBuffer`: keeps frames for pixel readback.
- `ready`: emitted once the surface is ready and the page is drawing.
- `failed`: emitted when the surface cannot start, as when CanvasKit fails to load.

A shell that splits the canvas into panes, or handles pointer input itself, calls the composables below directly.

## Related APIs

- [useCanvas](../composables/use-canvas)
- [useCanvasInput](../composables/use-canvas-input)
- [useTextEdit](../composables/use-text-edit)
