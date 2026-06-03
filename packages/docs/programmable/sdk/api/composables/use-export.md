---
title: useExport
description: Manage export settings like scale and format for the current selection.
---

# useExport

`useExport()` is the export-panel composable for selected nodes.

It manages:

- export settings rows
- selected node ids
- export name labeling
- supported scales and formats

## Usage

```ts
import { useExport } from '@inkly/vue'

const exportState = useExport()
```

## Basic example

```ts
const {
  settings,
  nodeName,
  scales,
  formats,
  addSetting,
  updateScale,
  updateFormat,
} = useExport()
```

## Practical examples

### Add another export preset

```ts
exportState.addSetting()
```

### Change the first export to 2x WEBP

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## Related APIs

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
