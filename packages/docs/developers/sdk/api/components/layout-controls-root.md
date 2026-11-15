---
title: LayoutControlsRoot
description: Headless root primitive for auto-layout and sizing controls.
---

<script setup lang="ts">
import { data } from './layout-controls-root.data'
</script>

# LayoutControlsRoot

`LayoutControlsRoot` exposes the slot contract returned by `useLayout()` as a structural primitive.
Use it when you want a reusable layout-controls shell with app-owned markup.

Width and height fields can remain editable while their axis uses Hug or Fill. On the first actual
numeric mutation, `updateAxisSize()` records the sizing transition and changes that axis to Fixed.
Compose the field with `BindableValue` and an interaction-batch-capable provider when sizing mode,
variable detachment, and the numeric value must commit or roll back as one undo step. Focus and
picker opening do not change sizing mode.

Use `setAxisSizing('width', mode)` or `setAxisSizing('height', mode)` for sizing menus. The older
axis-specific setters are not part of the current contract.

## Generated API reference

The following tables are extracted from the Vue source and JSDoc during the documentation build.

<SdkComponentAPI :components="data.components" />

## Related APIs

- [useLayout](../composables/use-layout)
- [BindableValue](./bindable-value)
- [Property Panels guide](../../guides/property-panels)
