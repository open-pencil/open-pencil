---
title: useMask
description: Read and update mask state for the selected node.
---

# useMask

`useMask()` provides headless state and actions for mask controls in a property panel.

## Usage

```ts
import { useMask } from '@open-pencil/vue'

const { active, maskType, setMaskType } = useMask()
```

- `active` is `true` when exactly one selected node is being used as a mask.
- `maskType` is the selected node's `ALPHA`, `VECTOR`, or `LUMINANCE` mask type.
- `setMaskType(type)` updates the active mask with undo support.

Use the `selection.toggleMask` editor command to turn masking on or off so toolbar, context-menu, and keyboard behavior stays consistent.

## Related APIs

- [useAppearance](./use-appearance)
- [useEditorCommands](./use-editor-commands)
- [SDK API Overview](../)
