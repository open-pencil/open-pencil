---
title: useSceneComputed
description: Convenience wrapper for scene-derived computed state.
---

# useSceneComputed

`useSceneComputed(fn)` is a thin computed wrapper used to make scene-backed derived state explicit in higher-level composables.

Use it when you want intent-revealing computed state that clearly depends on editor scene data.

## Related APIs

- [useSelectionState](../composables/use-selection-state)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
- [useNodeProps](./use-node-props)
