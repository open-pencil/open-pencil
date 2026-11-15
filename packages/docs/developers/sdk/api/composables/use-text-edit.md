---
title: useTextEdit
description: Manage DOM text editing, composition, formatting, and syncing for canvas text nodes.
---

# useTextEdit

`useTextEdit()` bridges DOM text input and the editor’s canvas text editing model.

It coordinates:

- textarea-backed text input
- IME composition
- caret blinking
- delete/backspace behavior
- formatting commands like bold/italic/underline
- syncing text changes back into the graph

## Usage

```ts
useTextEdit(canvasRef, editor)
```

## Basic example

Use this in the canvas owner component together with `useCanvas()` and `useCanvasInput()`.

## Practical examples

### Support formatting shortcuts

`useTextEdit()` already handles keyboard formatting actions like bold, italic, and underline while text editing is active.

### Keep canvas and text editor in sync

It updates graph text and style runs as the user types or edits formatted ranges.

## Notes

This is a canvas/editor integration composable, not a generic text-field composable.

## Related APIs

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
