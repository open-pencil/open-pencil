---
title: GradientEditorBar
description: Interaktiver Gradient bar zum Auswählen und Ziehen von Stops.
---

# GradientEditorBar

`GradientEditorBar` stellt State und Pointer handlers zum Rendern eines Gradient bar bereit. Der Component behandelt Selection und Drag der Stops.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stops', type: 'GradientStop[]', description: 'Aktuelle Gradient stops.', required: true },
    { name: 'activeStopIndex', type: 'number', description: 'Index des Active stop.', required: true },
    { name: 'barBackground', type: 'string', description: 'CSS background des Bar.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'selectStop', payload: 'index: number', description: 'Wird bei Auswahl eines Stop ausgegeben.' },
    { name: 'dragStop', payload: 'index: number, position: number', description: 'Wird während des Drag eines Stop ausgegeben.' }
  ]"
/>

## Beispiel

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

## Siehe auch

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
