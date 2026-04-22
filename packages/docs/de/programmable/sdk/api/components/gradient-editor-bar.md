---
title: GradientEditorBar
description: Headless ziehbares Balken-Primitiv für Verlaufsstopps.
---

# GradientEditorBar

`GradientEditorBar` ist das ziehbare Balken-Primitiv, das innerhalb von Verlaufs-Editoren verwendet wird.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stops', type: 'GradientStop[]', description: 'Aktuelle Verlaufsstopps.', required: true },
    { name: 'activeStopIndex', type: 'number', description: 'Aktiver Stopp-Index.', required: true },
    { name: 'barBackground', type: 'string', description: 'CSS-Hintergrund-String für den Balken.', required: true }
  ]"
/>

## Ereignisse

<SdkEventsTable
  :rows="[
    { name: 'selectStop', payload: 'index: number', description: 'Ausgelöst, wenn ein Stopp ausgewählt wird.' },
    { name: 'dragStop', payload: 'index: number, position: number', description: 'Ausgelöst, während ein Stopp gezogen wird.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'Balken-Zustand + Zieh-Handler', description: 'Vollständiger Verlaufsbalken-Render-Vertrag.' }
  ]"
/>

### Standard-Slot-Props

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

## Verwandte APIs

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
