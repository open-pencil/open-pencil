---
title: GradientEditorStop
description: Headless Slot-Primitiv für eine einzelne Verlaufsstopp-Zeile.
---

# GradientEditorStop

`GradientEditorStop` ist ein headless Primitiv zum Rendern und Bearbeiten eines einzelnen Verlaufsstopps.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stop', type: 'GradientStop', description: 'Aktueller Stopp-Wert.', required: true },
    { name: 'index', type: 'number', description: 'Aktueller Stopp-Index.', required: true },
    { name: 'active', type: 'boolean', description: 'Ob dieser Stopp aktiv ist.', required: true }
  ]"
/>

## Ereignisse

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'index: number', description: 'Ausgelöst, wenn der Stopp ausgewählt wird.' },
    { name: 'updatePosition', payload: 'index: number, position: number', description: 'Ausgelöst, wenn sich die Stopp-Position ändert.' },
    { name: 'updateColor', payload: 'index: number, hex: string', description: 'Ausgelöst, wenn sich die Stopp-Farbe ändert.' },
    { name: 'updateOpacity', payload: 'index: number, opacity: number', description: 'Ausgelöst, wenn sich die Stopp-Deckkraft ändert.' },
    { name: 'remove', payload: 'index: number', description: 'Ausgelöst, wenn der Stopp entfernt wird.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'Stopp-Zustand + Aktualisierungs-Handler', description: 'Vollständiger Verlaufsstopp-Render-Vertrag.' }
  ]"
/>

### Standard-Slot-Props

```ts
{
  stop: GradientStop
  index: number
  active: boolean
  positionPercent: number
  opacityPercent: number
  hex: string
  css: string
  select: () => void
  updatePosition: (position: number) => void
  updateColor: (hex: string) => void
  updateOpacity: (opacity: number) => void
  remove: () => void
}
```

## Beispiel

```vue
<GradientEditorStop :stop="stop" :index="index" :active="active" v-slot="ctx">
  <MyGradientStopRow v-bind="ctx" />
</GradientEditorStop>
```

## Verwandte APIs

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
