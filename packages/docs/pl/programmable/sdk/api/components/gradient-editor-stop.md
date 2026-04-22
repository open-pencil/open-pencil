---
title: GradientEditorStop
description: Bezstanowy prymityw slotu dla jednego wiersza punktu zatrzymania gradientu.
---

# GradientEditorStop

`GradientEditorStop` to bezstanowy prymityw do renderowania i edycji jednego punktu zatrzymania gradientu.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stop', type: 'GradientStop', description: 'Bieżąca wartość punktu zatrzymania.', required: true },
    { name: 'index', type: 'number', description: 'Bieżący indeks punktu zatrzymania.', required: true },
    { name: 'active', type: 'boolean', description: 'Czy ten punkt zatrzymania jest aktywny.', required: true }
  ]"
/>

## Zdarzenia

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'index: number', description: 'Emitowane gdy punkt zatrzymania jest zaznaczony.' },
    { name: 'updatePosition', payload: 'index: number, position: number', description: 'Emitowane gdy pozycja punktu zatrzymania się zmienia.' },
    { name: 'updateColor', payload: 'index: number, hex: string', description: 'Emitowane gdy kolor punktu zatrzymania się zmienia.' },
    { name: 'updateOpacity', payload: 'index: number, opacity: number', description: 'Emitowane gdy przezroczystość punktu zatrzymania się zmienia.' },
    { name: 'remove', payload: 'index: number', description: 'Emitowane gdy punkt zatrzymania jest usuwany.' }
  ]"
/>

## Sloty

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stan punktu zatrzymania + obsługa aktualizacji', description: 'Pełny kontrakt renderowania punktu zatrzymania gradientu.' }
  ]"
/>

### Właściwości slotu default

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

## Przykład

```vue
<GradientEditorStop :stop="stop" :index="index" :active="active" v-slot="ctx">
  <MyGradientStopRow v-bind="ctx" />
</GradientEditorStop>
```

## Powiązane API

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
