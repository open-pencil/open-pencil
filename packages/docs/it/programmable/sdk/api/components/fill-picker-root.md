---
title: FillPickerRoot
description: Primitiva popover headless per la selezione del riempimento.
---

# FillPickerRoot

`FillPickerRoot` è una primitiva popover headless per riempimenti solidi, a gradiente e immagine.

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Valore riempimento corrente.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Classe opzionale per il contenuto del popover.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Classe opzionale per il pulsante trigger predefinito.' }
  ]"
/>

## Eventi

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Emesso quando il riempimento cambia.' }
  ]"
/>

## Slot

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: 'stile campione', description: 'Trigger personalizzato con stile di sfondo campione.' },
    { name: 'default', props: 'stato riempimento + helper di conversione', description: 'Contenuto principale dell\'editor del riempimento.' }
  ]"
/>

### Slot prop del trigger

```ts
{
  style: Record<string, string>
}
```

### Slot prop predefiniti

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

## Esempio

```vue
<FillPickerRoot :fill="fill" @update="fill = $event">
  <template #default="{ fill, category, toSolid, toGradient, update }">
    <div>{{ category }}</div>
    <button @click="toSolid">Solido</button>
    <button @click="toGradient">Gradiente</button>
    <MyFillEditor :fill="fill" @change="update" />
  </template>
</FillPickerRoot>
```

## API correlate

- [GradientEditorRoot](./gradient-editor-root)
