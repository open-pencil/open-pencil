---
title: ColorInputRoot
description: Headless color input helper with hex parsing and update helpers.
---

# ColorInputRoot

`ColorInputRoot` is a headless helper for color input UIs.

It derives a hex value from a color and exposes update helpers for hex and full-color changes.

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Current color value.', required: true },
    { name: 'editable', type: 'boolean | undefined', description: 'Whether the consumer should present the value as editable.' }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Emitted when the color changes.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ color: Color, editable: boolean, hex: string, updateFromHex: (value: string) => void, updateColor: (color: Color) => void }', description: 'Main color input render contract.' }
  ]"
/>

## Example

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## Related APIs

- [ColorPickerRoot](./color-picker-root)
