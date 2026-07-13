---
title: Property Panels
description: Build property panels with control composables and headless list primitives.
---

# Property Panels

Property panels in `@open-pencil/vue` are intentionally composable-first.

If a panel mostly needs selection-derived values and update actions, prefer composables.
If a panel needs reusable array/list structure, use a headless primitive like `PropertyListRoot`.

## Common control composables

For standard property sections, start with:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

For list-style panels, use:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Binding-aware fields

Compose `BindableValueRoot` around fields that can reference variables or external design tokens.
The primitive is presentation-agnostic, but binding-aware interfaces should keep focus
non-destructive:

- Show variable identity while the field is idle; expose the resolved value in supporting UI such
  as a tooltip.
- Focusing or opening the picker must not detach a binding.
- Apply `detach-on-edit`, `readonly-when-bound`, or `edit-variable` only when the user actually
  changes the value.
- Put explicit detach actions in the picker rather than on a destructive one-click field icon.
- Keep binding replacement, detach-on-edit, and multi-target changes in one provider batch.

OpenPencil's app skin uses a violet variable-name pill at rest and reveals the resolved numeric
value when NumberField enters editing mode. Custom editor shells can present the same headless
state differently.

## Example: position panel

```vue
<script setup lang="ts">
import { usePosition } from '@open-pencil/vue'

const { x, y, width, height, updateProp, commitProp } = usePosition()
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <input :value="x" @input="updateProp('x', Number(($event.target as HTMLInputElement).value))" />
    <input :value="y" @input="updateProp('y', Number(($event.target as HTMLInputElement).value))" />
    <input :value="width" @input="updateProp('width', Number(($event.target as HTMLInputElement).value))" />
    <input :value="height" @input="updateProp('height', Number(($event.target as HTMLInputElement).value))" />
  </div>
</template>
```

## Example: fills panel

```vue
<script setup lang="ts">
import {
  PropertyListRoot,
  useEditorPropertyList,
  useFillControls
} from '@open-pencil/vue'

const fillControls = useFillControls()
const fills = useEditorPropertyList('fills')
</script>

<template>
  <PropertyListRoot
    prop-key="fills"
    :items="fills.items.value"
    :mixed="fills.isMixed.value"
    @add="fills.actions.add"
    @remove="fills.actions.remove"
    v-slot="{ items, actions }"
  >
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="actions.remove(index)">Remove</button>
    </div>

    <button @click="actions.add(fillControls.defaultFill)">Add fill</button>
  </PropertyListRoot>
</template>
```

## Rule of thumb

- use composables for direct control logic
- use structural primitives when repeated list/tree/slot coordination is the hard part

## Related APIs

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
