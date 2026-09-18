---
title: useComponentProperties
description: Read and edit variant, text, boolean, and instance-swap properties on instances.
---

# useComponentProperties

`useComponentProperties()` exposes compatible component properties for the selected instances and an
undo-aware value action.

```ts
import { useComponentProperties } from '@open-pencil/vue'

const { active, controls, setValue } = useComponentProperties()

// Property IDs are stable Figma definition IDs when imported from .fig.
setValue('12:34', 'Enabled')
```

Each item in `controls` contains:

- `id` and `name` from the component property definition;
- `type`: `VARIANT`, `TEXT`, `BOOLEAN`, or `INSTANCE_SWAP`;
- `value`: a string or `MIXED`;
- `options` for variant and instance-swap controls.

`active` is true only when every selected node is an instance and each instance exposes the same
ordered property IDs and types. Compatible multi-selection changes are grouped into one undo entry.

For live text inputs, call `setTextValue(propertyId, value)` on each model update and `flush()` on
blur or Enter. Text appears immediately, while rapid changes share an undo entry. Batches also finish
after an idle pause, a selection/page change, or scope disposal. `setValue()` remains a discrete edit.

Text and boolean properties update the referenced instance descendant. Instance-swap properties
replace the referenced nested instance. Variant changes swap the main component and then reapply
non-variant assignments, so custom labels, visibility, and nested swaps survive the change and its
undo/redo cycle.

Imported `.fig` definitions retain typed defaults, property references, assignments, and preferred
instance-swap values. Missing swap targets remain explicit rather than silently selecting another
component.

## Related APIs

- [useSelectionState](./use-selection-state)
- [useSharedStyleBinding](./use-shared-style-binding)
- [Property Panels guide](../../guides/property-panels)
