---
title: ScrubInputRoot
description: Primitivo raíz headless para input numérico con arrastre para ajustar.
---

# ScrubInputRoot

`ScrubInputRoot` es el primitivo raíz headless para input numérico con arrastre para ajustar.

Gestiona:

- visualización de valores mixtos
- estado de edición vs arrastre
- ajuste numérico impulsado por el puntero
- semántica de confirmación para ediciones finalizadas

## Props

<SdkPropsTable
  :rows="[
    { name: 'modelValue', type: 'number | symbol', description: 'Valor numérico actual o centinela de valor mixto.', required: true },
    { name: 'min', type: 'number | undefined', description: 'Valor mínimo permitido.', default: '-Infinity' },
    { name: 'max', type: 'number | undefined', description: 'Valor máximo permitido.', default: 'Infinity' },
    { name: 'step', type: 'number | undefined', description: 'Multiplicador de paso del arrastre.', default: '1' },
    { name: 'sensitivity', type: 'number | undefined', description: 'Multiplicador de sensibilidad del puntero.', default: '1' },
    { name: 'placeholder', type: 'string | undefined', description: 'Placeholder para valores mixtos.', default: 'Mixed' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model:modelValue', type: 'number', description: 'Modelo numérico escribible.', required: true }
  ]"
/>

## Eventos

<SdkEventsTable
  :rows="[
    { name: 'update:modelValue', payload: 'value: number', description: 'Emitido durante el arrastre o la edición.' },
    { name: 'commit', payload: 'value: number, previous: number', description: 'Emitido cuando se confirma una interacción de edición.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ modelValue: number | symbol, displayValue: string, isMixed: boolean, editing: boolean, scrubbing: boolean, startScrub: (event: PointerEvent) => void, startEdit: () => void, commitEdit: (event: Event) => void, keydown: (event: KeyboardEvent) => void, placeholder: string }', description: 'Contrato completo de renderizado del scrub input.' }
  ]"
/>

## Ejemplo

```vue
<ScrubInputRoot v-model:model-value="value" @commit="commit" v-slot="ctx">
  <div @pointerdown="ctx.startScrub">
    <ScrubInputDisplay />
    <ScrubInputField class="w-16" />
  </div>
</ScrubInputRoot>
```

## APIs relacionadas

- [ScrubInputField](./scrub-input-field)
- [ScrubInputDisplay](./scrub-input-display)
