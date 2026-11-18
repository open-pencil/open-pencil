---
title: useCanvasInput
description: Wire canvas pointer input, dragging, selection, resize, rotation, and tool behavior.
---

# useCanvasInput

`useCanvasInput()` connects pointer and mouse interaction to the editor canvas.

It handles interaction concerns like:

- selection
- dragging
- resize
- rotation
- panning
- pen/draw flows
- text editing interaction
- scope-aware hit testing

## Usage

This composable is typically paired with `useCanvas()` and hit-test helpers from the renderer.

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
)
```

## Basic example

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

## Practical examples

### Track cursor movement in canvas space

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

## Notes

This composable is lower-level than most panel logic. It is best suited for editor shells and canvas containers.

## Related APIs

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
