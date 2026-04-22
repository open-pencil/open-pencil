---
title: ColorInputRoot
description: Helper headless per input colore con parsing hex e helper di aggiornamento.
---

# ColorInputRoot

`ColorInputRoot` è un helper headless per le UI di input del colore.

Deriva un valore hex da un colore ed espone helper di aggiornamento per modifiche hex e colore completo.

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Valore colore corrente.', required: true },
    { name: 'editable', type: 'boolean | undefined', description: 'Se il consumatore deve presentare il valore come modificabile.' }
  ]"
/>

## Eventi

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Emesso quando il colore cambia.' }
  ]"
/>

## Slot

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ color: Color, editable: boolean, hex: string, updateFromHex: (value: string) => void, updateColor: (color: Color) => void }', description: 'Contratto di rendering principale per l\'input del colore.' }
  ]"
/>

## Esempio

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## API correlate

- [ColorPickerRoot](./color-picker-root)
