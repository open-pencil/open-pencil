---
title: useLayout
description: Work with auto-layout, sizing, padding, alignment, and grid tracks.
---

# useLayout

`useLayout()` is the main control composable for layout-related panels.

It exposes state and actions for:

- flex vs grid mode
- width/height sizing and editable derived dimensions
- minimum and maximum size limits
- padding
- alignment
- grid template track editing

## Usage

```ts
import { useLayout } from '@open-pencil/vue'

const layout = useLayout()
```

## Axis sizing

```ts
const {
  widthSizing,
  heightSizing,
  setAxisSizing,
  updateAxisSize,
  commitAxisSize,
} = useLayout()

setAxisSizing('width', 'HUG')
setAxisSizing('height', 'FILL')
```

Connect `updateAxisSize()` and `commitAxisSize()` to a numeric field. Editing a Hug or Fill value
switches only that axis to Fixed on the first actual mutation:

```vue
<NumberFieldRoot
  :model-value="layout.node.value?.width ?? 0"
  @update:model-value="layout.updateAxisSize('width', $event)"
  @commit="(value, previous) => layout.commitAxisSize('width', value, previous)"
/>
```

For one-step commit and Escape rollback across a sizing-mode change, variable detachment, and the
numeric value, compose the NumberField with `BindableValue` using a provider that implements
interaction batches. Merely focusing the field does not switch its sizing mode.

## Aspect ratio lock

```ts
const { aspectRatioLocked, aspectRatioLockable, toggleAspectRatioLock } = useLayout()
```

`toggleAspectRatioLock()` locks the selected layer to its current proportions or unlocks it.
While it is locked, `updateAxisSize()` changes both sides. `aspectRatioLockable` is false for a
layer inside an instance, which keeps its component's lock.

## Size limits

```ts
layout.addSizeLimit('minWidth')
layout.setSizeLimitToCurrent('minWidth')
layout.removeSizeLimit('minWidth')
```

## Practical examples

### Toggle between uniform and individual padding UI

```ts
layout.toggleIndividualPadding()
```

### Update grid tracks

```ts
layout.updateGridTrack('gridTemplateColumns', 0, { sizing: 'FIXED', value: 240 })
layout.addTrack('gridTemplateRows')
```

### Change alignment

```ts
layout.setAlignment('CENTER', 'MAX')
```

## Related APIs

- [LayoutControlsRoot](../components/layout-controls-root)
- [BindableValue](../components/bindable-value)
- [usePosition](./use-position)
- [useEditor](./use-editor)
