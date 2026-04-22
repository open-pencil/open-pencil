---
title: FillPickerRoot
description: Primitivo headless de selector de relleno basado en popover.
---

# FillPickerRoot

`FillPickerRoot` es un primitivo headless de selector de relleno basado en popover para rellenos sólidos, degradados e imágenes.

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Valor de relleno actual.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Clase opcional para el contenido del popover.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Clase opcional para el botón trigger por defecto.' }
  ]"
/>

## Eventos

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Emitido cuando el relleno cambia.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: 'swatch style', description: 'Trigger personalizado con estilo de fondo de muestra.' },
    { name: 'default', props: 'fill state + conversion helpers', description: 'Contenido principal del editor de relleno.' }
  ]"
/>

### Props del slot trigger

```ts
{
  style: Record<string, string>
}
```

### Props del slot default

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

## Ejemplo

```vue
<FillPickerRoot :fill="fill" @update="fill = $event">
  <template #default="{ fill, category, toSolid, toGradient, update }">
    <div>{{ category }}</div>
    <button @click="toSolid">Sólido</button>
    <button @click="toGradient">Degradado</button>
    <MyFillEditor :fill="fill" @change="update" />
  </template>
</FillPickerRoot>
```

## APIs relacionadas

- [GradientEditorRoot](./gradient-editor-root)
