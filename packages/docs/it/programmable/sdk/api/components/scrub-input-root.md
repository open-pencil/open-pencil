---
title: ScrubInputRoot
description: Primitiva root headless per input numerico con trascinamento scrub.
---

# ScrubInputRoot

`ScrubInputRoot` è la primitiva root headless per l'input numerico con trascinamento scrub.

Gestisce:

- la visualizzazione di valori misti
- lo stato di modifica vs scrubbing
- lo scrubbing numerico guidato dal puntatore
- la semantica di commit per le modifiche completate

## Props

<SdkPropsTable
  :rows="[
    { name: 'modelValue', type: 'number | symbol', description: 'Valore numerico corrente o sentinel misto.', required: true },
    { name: 'min', type: 'number | undefined', description: 'Valore minimo consentito.', default: '-Infinity' },
    { name: 'max', type: 'number | undefined', description: 'Valore massimo consentito.', default: 'Infinity' },
    { name: 'step', type: 'number | undefined', description: 'Moltiplicatore di passo per lo scrub.', default: '1' },
    { name: 'sensitivity', type: 'number | undefined', description: 'Moltiplicatore di sensibilità del puntatore.', default: '1' },
    { name: 'placeholder', type: 'string | undefined', description: 'Placeholder per valori misti.', default: 'Mixed' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model:modelValue', type: 'number', description: 'Model numerico scrivibile.', required: true }
  ]"
/>

## Eventi

<SdkEventsTable
  :rows="[
    { name: 'update:modelValue', payload: 'value: number', description: 'Emesso durante scrubbing o modifica.' },
    { name: 'commit', payload: 'value: number, previous: number', description: 'Emesso quando un\'interazione di modifica viene completata.' }
  ]"
/>

## Slot

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ modelValue: number | symbol, displayValue: string, isMixed: boolean, editing: boolean, scrubbing: boolean, startScrub: (event: PointerEvent) => void, startEdit: () => void, commitEdit: (event: Event) => void, keydown: (event: KeyboardEvent) => void, placeholder: string }', description: 'Contratto di rendering completo per lo scrub input.' }
  ]"
/>

## Esempio

```vue
<ScrubInputRoot v-model:model-value="value" @commit="commit" v-slot="ctx">
  <div @pointerdown="ctx.startScrub">
    <ScrubInputDisplay />
    <ScrubInputField class="w-16" />
  </div>
</ScrubInputRoot>
```

## API correlate

- [ScrubInputField](./scrub-input-field)
- [ScrubInputDisplay](./scrub-input-display)
