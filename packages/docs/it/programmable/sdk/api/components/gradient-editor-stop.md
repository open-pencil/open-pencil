---
title: GradientEditorStop
description: Primitiva slot headless per una singola riga di stop del gradiente.
---

# GradientEditorStop

`GradientEditorStop` è una primitiva headless per il rendering e la modifica di un singolo stop del gradiente.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stop', type: 'GradientStop', description: 'Valore stop corrente.', required: true },
    { name: 'index', type: 'number', description: 'Indice stop corrente.', required: true },
    { name: 'active', type: 'boolean', description: 'Se questo stop è attivo.', required: true }
  ]"
/>

## Eventi

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'index: number', description: 'Emesso quando lo stop viene selezionato.' },
    { name: 'updatePosition', payload: 'index: number, position: number', description: 'Emesso quando la posizione dello stop cambia.' },
    { name: 'updateColor', payload: 'index: number, hex: string', description: 'Emesso quando il colore dello stop cambia.' },
    { name: 'updateOpacity', payload: 'index: number, opacity: number', description: 'Emesso quando l\'opacità dello stop cambia.' },
    { name: 'remove', payload: 'index: number', description: 'Emesso quando lo stop viene rimosso.' }
  ]"
/>

## Slot

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stato stop + handler di aggiornamento', description: 'Contratto di rendering completo per lo stop del gradiente.' }
  ]"
/>

### Slot prop predefiniti

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

## Esempio

```vue
<GradientEditorStop :stop="stop" :index="index" :active="active" v-slot="ctx">
  <MyGradientStopRow v-bind="ctx" />
</GradientEditorStop>
```

## API correlate

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
