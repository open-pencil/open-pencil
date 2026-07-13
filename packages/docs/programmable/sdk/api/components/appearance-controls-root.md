---
title: AppearanceControlsRoot
description: Headless root primitive for opacity, visibility, blend mode, and corner-radius controls.
---

<script setup lang="ts">
import { data } from './appearance-controls-root.data'
</script>

# AppearanceControlsRoot

`AppearanceControlsRoot` exposes the slot contract returned by `useAppearance()` as a structural
primitive. Use it when you want reusable appearance controls with custom presentation.

The root owns selection-derived presentation decisions, including `showIndependentCorners`.
That state becomes active when the selected node explicitly uses independent corners or when an
imported node contains unequal corner values with a stale uniform flag. Consumers should render
from this state rather than maintaining a parallel local expansion ref.

Multi-node independent-corner toggles and per-corner commits are grouped into one undo entry.

## Generated API reference

The following tables are extracted from the Vue source and JSDoc during the documentation build.

<SdkComponentAPI :components="data.components" />

## Related APIs

- [useAppearance](../composables/use-appearance)
- [Property Panels guide](../../guides/property-panels)
