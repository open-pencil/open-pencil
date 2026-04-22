---
title: ColorInputRoot
description: Bezstanowy pomocnik pola wejściowego koloru z parsowaniem hex i pomocnikami aktualizacji.
---

# ColorInputRoot

`ColorInputRoot` to bezstanowy pomocnik dla UI pól wejściowych kolorów.

Wyprowadza wartość hex z koloru i udostępnia pomocniki aktualizacji dla hex i pełnych zmian koloru.

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Bieżąca wartość koloru.', required: true },
    { name: 'editable', type: 'boolean | undefined', description: 'Czy konsument powinien prezentować wartość jako edytowalną.' }
  ]"
/>

## Zdarzenia

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Emitowane gdy kolor się zmienia.' }
  ]"
/>

## Sloty

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ color: Color, editable: boolean, hex: string, updateFromHex: (value: string) => void, updateColor: (color: Color) => void }', description: 'Główny kontrakt renderowania pola wejściowego koloru.' }
  ]"
/>

## Przykład

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## Powiązane API

- [ColorPickerRoot](./color-picker-root)
