---
title: ScrubInputRoot
description: Bezstanowy prymityw korzenia dla numerycznego pola wejściowego z przeciąganiem.
---

# ScrubInputRoot

`ScrubInputRoot` to bezstanowy prymityw korzenia dla numerycznego pola wejściowego z przeciąganiem.

Zarządza:

- wyświetlaniem wartości mieszanych
- stanem edycji vs przeciągania
- numerycznym przeciąganiem sterowanym wskaźnikiem
- semantyką zatwierdzania zakończonych edycji

## Props

<SdkPropsTable
  :rows="[
    { name: 'modelValue', type: 'number | symbol', description: 'Bieżąca wartość liczbowa lub sentinel wartości mieszanej.', required: true },
    { name: 'min', type: 'number | undefined', description: 'Minimalna dozwolona wartość.', default: '-Infinity' },
    { name: 'max', type: 'number | undefined', description: 'Maksymalna dozwolona wartość.', default: 'Infinity' },
    { name: 'step', type: 'number | undefined', description: 'Mnożnik kroku przeciągania.', default: '1' },
    { name: 'sensitivity', type: 'number | undefined', description: 'Mnożnik czułości wskaźnika.', default: '1' },
    { name: 'placeholder', type: 'string | undefined', description: 'Placeholder dla wartości mieszanych.', default: 'Mixed' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model:modelValue', type: 'number', description: 'Zapisywalny model liczbowy.', required: true }
  ]"
/>

## Zdarzenia

<SdkEventsTable
  :rows="[
    { name: 'update:modelValue', payload: 'value: number', description: 'Emitowane podczas przeciągania lub edycji.' },
    { name: 'commit', payload: 'value: number, previous: number', description: 'Emitowane gdy interakcja edycji zostaje zatwierdzona.' }
  ]"
/>

## Sloty

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ modelValue: number | symbol, displayValue: string, isMixed: boolean, editing: boolean, scrubbing: boolean, startScrub: (event: PointerEvent) => void, startEdit: () => void, commitEdit: (event: Event) => void, keydown: (event: KeyboardEvent) => void, placeholder: string }', description: 'Pełny kontrakt renderowania pola przeciągania.' }
  ]"
/>

## Przykład

```vue
<ScrubInputRoot v-model:model-value="value" @commit="commit" v-slot="ctx">
  <div @pointerdown="ctx.startScrub">
    <ScrubInputDisplay />
    <ScrubInputField class="w-16" />
  </div>
</ScrubInputRoot>
```

## Powiązane API

- [ScrubInputField](./scrub-input-field)
- [ScrubInputDisplay](./scrub-input-display)
