---
title: useSharedStyleBinding
description: Apply and detach local fill, stroke, text, effect, and grid styles.
---

# useSharedStyleBinding

`useSharedStyleBinding(kind)` exposes the selected nodes' shared-style reference, compatible local
style definitions, and undo-aware bind/detach actions.

```ts
import { useSharedStyleBinding } from '@open-pencil/vue/controls/shared-style'

const fillStyle = useSharedStyleBinding('fill')

fillStyle.bind('1:120')
fillStyle.unbind()
```

Supported kinds are `fill`, `stroke`, `text`, `effect`, and `grid`.

- `active` requires every selected node to support the requested style domain.
- `styleId` is the shared ID, `null`, or `MIXED`.
- `styles` lists compatible local definitions imported with the document.
- `bind(id)` applies supported style properties and the reference in one undo step.
- `unbind()` keeps the resolved properties and removes only the reference.
- Multi-selection changes are grouped into one undo entry.

Manual edits to fills, strokes, supported text properties, effects, or layout grids automatically
detach the matching style reference. Other style domains remain bound.

OpenPencil currently consumes styles already present in a document. Creating, renaming, publishing,
and synchronizing style libraries is outside this composable's scope.

## Related APIs

- [useFillControls](./use-fill-controls)
- [useStrokeControls](./use-stroke-controls)
- [useTypography](./use-typography)
- [useEffectsControls](./use-effects-controls)
- [Property Panels guide](../../guides/property-panels)
