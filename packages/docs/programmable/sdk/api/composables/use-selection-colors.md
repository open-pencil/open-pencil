---
title: useSelectionColors
description: Figma's Selection colors list for the current selection, with an edit that recolours every paint using a colour.
---

# useSelectionColors

`useSelectionColors()` lists each solid fill and stroke colour of the selected layers and their
descendants, most used first. Effect colours and colours bound to a variable are left out. `shown`
is true when Figma shows the list: the Fill and Stroke sections can't already show every colour,
because they differ across the selection or a selected layer has children.

## Usage

```ts
import { useSelectionColors } from '@open-pencil/vue'

const selection = useSelectionColors()

// Recolour every paint that uses the first colour.
selection.replace(0, { color: { r: 0, g: 0.5, b: 1, a: 1 }, opacity: 1 })
```

Edits made in quick succession, such as dragging in a colour picker, become one undo step. Call
`begin()` when a row's picker opens and `finish()` when it closes to keep the list's order steady
while the colour changes.

## Related APIs

- [useSelectionLayout](./use-selection-layout)
- [useFillControls](./use-fill-controls)
