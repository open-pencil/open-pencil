---
title: GradientEditorRoot
description: Bezstanowy prymityw korzenia do edycji punktów zatrzymania gradientu.
---

# GradientEditorRoot

`GradientEditorRoot` to bezstanowy prymityw korzenia do edycji gradientów.

Zarządza:

- stanem aktywnego punktu zatrzymania
- przełączaniem podtypów
- logiką dodawania/usuwania/aktualizacji punktów
- edycją aktywnego koloru
- pochodnym tłem paska

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Bieżąca wartość wypełnienia gradientowego.', required: true }
  ]"
/>

## Zdarzenia

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Emitowane gdy wypełnienie gradientowe się zmienia.' }
  ]"
/>

## Sloty

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stan edytora + obsługa', description: 'Pełny kontrakt renderowania edytora gradientu.' }
  ]"
/>

### Właściwości slotu default

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

## Przykład

```vue
<GradientEditorRoot :fill="fill" @update="fill = $event" v-slot="ctx">
  <MyGradientUI v-bind="ctx" />
</GradientEditorRoot>
```

## Powiązane API

- [GradientEditorBar](./gradient-editor-bar)
- [GradientEditorStop](./gradient-editor-stop)
