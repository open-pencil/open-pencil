---
title: ColorInputRoot
description: Helper headless de input de color con análisis hexadecimal y helpers de actualización.
---

# ColorInputRoot

`ColorInputRoot` es un helper headless para interfaces de input de color.

Deriva un valor hexadecimal a partir de un color y expone helpers de actualización para cambios hexadecimales y de color completo.

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Valor de color actual.', required: true },
    { name: 'editable', type: 'boolean | undefined', description: 'Si el consumidor debe presentar el valor como editable.' }
  ]"
/>

## Eventos

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Emitido cuando el color cambia.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ color: Color, editable: boolean, hex: string, updateFromHex: (value: string) => void, updateColor: (color: Color) => void }', description: 'Contrato principal de renderizado del input de color.' }
  ]"
/>

## Ejemplo

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## APIs relacionadas

- [ColorPickerRoot](./color-picker-root)
