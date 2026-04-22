---
title: GradientEditorRoot
description: Headless Wurzel-Primitiv für Verlaufsstopp-Bearbeitung.
---

# GradientEditorRoot

`GradientEditorRoot` ist ein headless Wurzel-Primitiv für Verlaufsbearbeitung.

Es verwaltet:

- aktiven Stopp-Zustand
- Subtyp-Wechsel
- Stopp hinzufügen/entfernen/aktualisieren Logik
- aktive Farbbearbeitung
- abgeleiteten Balken-Hintergrund

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Aktueller Verlaufsfüllungswert.', required: true }
  ]"
/>

## Ereignisse

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Ausgelöst, wenn sich die Verlaufsfüllung ändert.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'Editor-Zustand + Handler', description: 'Vollständiger Verlaufs-Editor-Render-Vertrag.' }
  ]"
/>

### Standard-Slot-Props

```ts
{
  stops: GradientStop[]
  subtype: GradientSubtype
  subtypes: Array<{ value: GradientSubtype; label: string }>
  activeStopIndex: number
  activeColor: Color
  barBackground: string
  setSubtype: (type: GradientSubtype) => void
  selectStop: (index: number) => void
  addStop: () => void
  removeStop: (index: number) => void
  updateStopPosition: (index: number, position: number) => void
  updateStopColor: (index: number, hex: string) => void
  updateStopOpacity: (index: number, opacity: number) => void
  updateActiveColor: (color: Color) => void
  dragStop: (index: number, position: number) => void
}
```

## Beispiel

```vue
<GradientEditorRoot :fill="fill" @update="fill = $event" v-slot="ctx">
  <MyGradientUI v-bind="ctx" />
</GradientEditorRoot>
```

## Verwandte APIs

- [GradientEditorBar](./gradient-editor-bar)
- [GradientEditorStop](./gradient-editor-stop)
