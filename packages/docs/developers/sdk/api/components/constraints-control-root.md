---
title: ConstraintsControlRoot
description: Headless constraint state and actions for frame children.
---

<script setup lang="ts">
import { data } from './constraints-control-root.data'
</script>

# ConstraintsControlRoot

`ConstraintsControlRoot` exposes horizontal and vertical resize constraints for the current eligible
selection. It is active for children of frames, components, component sets, and instances. Normal
auto-layout children and top-level page layers are excluded; absolutely positioned auto-layout
children remain eligible.

The default slot provides concrete or mixed axis values and undo-aware actions for setting modes or
building an interactive pin control. Multi-selection changes are grouped into one undo entry.

Constraint values match the Figma Plugin API: `MIN`, `CENTER`, `MAX`, `STRETCH`, and `SCALE`.

## Generated API reference

The following tables are extracted from the Vue source and JSDoc during the documentation build.

<SdkComponentAPI :components="data.components" />

## Related APIs

- [PositionControlsRoot](./position-controls-root)
- [LayoutControlsRoot](./layout-controls-root)
- [Property Panels guide](../../guides/property-panels)
