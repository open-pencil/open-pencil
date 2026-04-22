---
title: FillPickerRoot
description: Bezstanowy prymityw selektora wypełnień oparty na popover.
---

# FillPickerRoot

`FillPickerRoot` to bezstanowy prymityw selektora wypełnień oparty na popover dla wypełnień jednolitych, gradientowych i obrazkowych.

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Bieżąca wartość wypełnienia.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Opcjonalna klasa dla zawartości popover.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Opcjonalna klasa dla domyślnego przycisku wyzwalacza.' }
  ]"
/>

## Zdarzenia

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Emitowane gdy wypełnienie się zmienia.' }
  ]"
/>

## Sloty

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: 'styl próbki', description: 'Niestandardowy wyzwalacz ze stylem tła próbki.' },
    { name: 'default', props: 'stan wypełnienia + pomocniki konwersji', description: 'Główna zawartość edytora wypełnień.' }
  ]"
/>

### Właściwości slotu trigger

```ts
{
  style: Record<string, string>
}
```

### Właściwości slotu default

```ts
{
  fill: Fill
  category: 'SOLID' | 'GRADIENT' | 'IMAGE'
  toSolid: () => void
  toGradient: () => void
  toImage: () => void
  update: (fill: Fill) => void
}
```

## Przykład

```vue
<FillPickerRoot :fill="fill" @update="fill = $event">
  <template #default="{ fill, category, toSolid, toGradient, update }">
    <div>{{ category }}</div>
    <button @click="toSolid">Jednolite</button>
    <button @click="toGradient">Gradient</button>
    <MyFillEditor :fill="fill" @change="update" />
  </template>
</FillPickerRoot>
```

## Powiązane API

- [GradientEditorRoot](./gradient-editor-root)
