---
title: GradientEditorBar
description: Bezstanowy przeciągany prymityw paska dla punktów zatrzymania gradientu.
---

# GradientEditorBar

`GradientEditorBar` to przeciągany prymityw paska używany wewnątrz edytorów gradientu.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stops', type: 'GradientStop[]', description: 'Bieżące punkty zatrzymania gradientu.', required: true },
    { name: 'activeStopIndex', type: 'number', description: 'Indeks aktywnego punktu zatrzymania.', required: true },
    { name: 'barBackground', type: 'string', description: 'Ciąg CSS tła dla paska.', required: true }
  ]"
/>

## Zdarzenia

<SdkEventsTable
  :rows="[
    { name: 'selectStop', payload: 'index: number', description: 'Emitowane gdy punkt zatrzymania jest zaznaczony.' },
    { name: 'dragStop', payload: 'index: number, position: number', description: 'Emitowane podczas przeciągania punktu zatrzymania.' }
  ]"
/>

## Sloty

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stan paska + obsługa przeciągania', description: 'Pełny kontrakt renderowania paska gradientu.' }
  ]"
/>

### Właściwości slotu default

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

## Przykład

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

## Powiązane API

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
