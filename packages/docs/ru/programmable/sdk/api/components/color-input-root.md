---
title: ColorInputRoot
description: Headless-хелпер для ввода цвета с разбором HEX и хелперами обновления.
---

# ColorInputRoot

`ColorInputRoot` — headless-хелпер для UI ввода цвета.

Выводит hex-значение из цвета и предоставляет хелперы обновления для hex и полного значения цвета.

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Текущее значение цвета.', required: true },
    { name: 'editable', type: 'boolean | undefined', description: 'Должен ли потребитель представить значение как редактируемое.' }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Генерируется при изменении цвета.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ color: Color, editable: boolean, hex: string, updateFromHex: (value: string) => void, updateColor: (color: Color) => void }', description: 'Основной контракт рендеринга ввода цвета.' }
  ]"
/>

## Пример

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## Связанные API

- [ColorPickerRoot](./color-picker-root)
