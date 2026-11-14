---
title: useConstraints
description: Read and update resize constraints for eligible frame children.
---

# useConstraints

`useConstraints()` provides selection-derived horizontal and vertical constraint state plus
undo-aware actions.

```ts
import { useConstraints } from '@open-pencil/vue/controls/constraints'

const constraints = useConstraints()
constraints.setAxis('horizontal', 'STRETCH')
constraints.togglePin('vertical', 'trailing', false)
```

- `active` requires every selected node to be an eligible child of a frame-like container.
- `horizontal` and `vertical` return `MIN`, `CENTER`, `MAX`, `STRETCH`, `SCALE`, or `MIXED`.
- Multi-selection updates are grouped into one undo entry.
- Normal auto-layout children are excluded; absolutely positioned children remain eligible.

Use `constraintPins()` and `toggleConstraintPin()` to build a custom accessible pin diagram without
duplicating mode mapping.

## Related APIs

- [ConstraintsControlRoot](../components/constraints-control-root)
- [PositionControlsRoot](../components/position-controls-root)
- [Property Panels guide](../../guides/property-panels)
