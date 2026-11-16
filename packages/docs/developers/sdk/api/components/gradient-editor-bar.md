---
title: GradientEditorBar
description: Headless draggable bar primitive for gradient stops.
---

# GradientEditorBar

`GradientEditorBar` is the draggable bar primitive used inside gradient editors.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stops', type: 'GradientStop[]', description: 'Current gradient stops.', required: true },
    { name: 'activeStopIndex', type: 'number', description: 'Active stop index.', required: true },
    { name: 'barBackground', type: 'string', description: 'CSS background string for the bar.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'selectStop', payload: 'index: number', description: 'Emitted when a stop is selected.' },
    { name: 'dragStop', payload: 'index: number, position: number', description: 'Emitted while a stop is dragged.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'bar state + drag handlers', description: 'Full gradient bar render contract.' }
  ]"
/>

### Default slot props

```ts
{
  stops: GradientStop[]
  activeStopIndex: number
  barBackground: string
  barRef: (el: unknown) => void
  onStopPointerDown: (index: number, event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: () => void
  draggingIndex: number | null
}
```

## Example

```vue
<GradientEditorBar
  :stops="stops"
  :active-stop-index="activeStopIndex"
  :bar-background="barBackground"
  @select-stop="selectStop"
  @drag-stop="dragStop"
  v-slot="ctx"
>
  <MyGradientBar v-bind="ctx" />
</GradientEditorBar>
```

## Related APIs

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
