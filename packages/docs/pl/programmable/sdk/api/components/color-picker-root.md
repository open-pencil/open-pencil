---
title: ColorPickerRoot
description: Bezstanowy prymityw selektora kolorów oparty na popover.
---

# ColorPickerRoot

`ColorPickerRoot` to bezstanowy prymityw selektora kolorów oparty na popover.

Udostępnia:

- slot wyzwalacza ze stylowaniem tła próbki
- domyślny wyzwalacz zastępczy
- slot zawartości z `color` i `update()`

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Bieżąca wartość koloru.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Opcjonalna klasa dla zawartości popover.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Opcjonalna klasa dla domyślnego przycisku wyzwalacza.' }
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
    { name: 'trigger', props: '{ style: Record<string, string> }', description: 'Niestandardowy wyzwalacz ze stylem tła próbki.' },
    { name: 'default', props: '{ color: Color, update: (color: Color) => void }', description: 'Główna zawartość edytora kolorów.' }
  ]"
/>

## Przykład

```vue
<ColorPickerRoot :color="color" @update="color = $event">
  <template #trigger="{ style }">
    <button class="size-6 rounded border" :style="style" />
  </template>

  <template #default="{ color, update }">
    <MyColorEditor :color="color" @change="update" />
  </template>
</ColorPickerRoot>
```

## Powiązane API

- [ColorInputRoot](./color-input-root)
