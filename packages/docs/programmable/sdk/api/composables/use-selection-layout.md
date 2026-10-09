---
title: useSelectionLayout
description: Layout of a multi-selection as Figma shows it, with text resizing, flow, clip content, and spacing.
---

# useSelectionLayout

`useSelectionLayout()` reads and edits the layout of the selected layers the way Figma's panel does
for several layers. Each value is the one the relevant layers share, `MIXED` when they differ, or
`undefined` when no selected layer has it:

- `textResize` — resizing of the selected text layers
- `layoutMode` — flow, when every selected layer can hold an auto layout
- `clipsContent` — clip content of the layers that can clip
- `spacing` and `spacingAxis` — the gap between neighbours when the layers form one row or column

Each action changes only the layers it applies to, in one undo step.

## Usage

```ts
import { useSelectionLayout } from '@open-pencil/vue'

const layout = useSelectionLayout()

layout.setTextResize('AUTO_HEIGHT')
layout.setLayoutMode('VERTICAL')
layout.toggleClipsContent()
layout.setSpacing(16)
```

`setSpacing` keeps the first layer of the row in place and spaces the rest after it.

## Related APIs

- [useLayout](./use-layout)
- [useSelectionColors](./use-selection-colors)
