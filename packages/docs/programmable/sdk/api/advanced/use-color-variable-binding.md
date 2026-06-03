---
title: useColorVariableBinding
description: Variable-binding helper for fill and stroke color editors.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` exposes search, binding, and unbinding helpers for color variables used by fill and stroke editors.

Use it when building color UIs that need to connect fills or strokes to design variables.

## Usage

```ts
import { useColorVariableBinding } from '@inkly/vue'

const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## Related APIs

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [FillPickerRoot](../components/fill-picker-root)
