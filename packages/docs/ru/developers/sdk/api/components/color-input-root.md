---
title: ColorInputRoot
description: Разбор шестнадцатеричного цвета и обновление значения в собственном поле ввода.
---

# ColorInputRoot

`ColorInputRoot` преобразует текущее значение `Color` в шестнадцатеричную строку и предоставляет функции обновления из строки или полного объекта `Color`.

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Текущее значение цвета.', required: true },
    { name: 'editable', type: 'boolean | undefined', description: 'Следует ли показывать значение как доступное для редактирования.' }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Вызывается после изменения цвета.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ color: Color, editable: boolean, hex: string, updateFromHex: (value: string) => void, updateColor: (color: Color) => void }', description: 'Состояние и действия для отображения поля цвета.' }
  ]"
/>

## Пример

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## См. также

- [ColorPickerRoot](./color-picker-root)
