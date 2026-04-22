---
title: GradientEditorRoot
description: Primitivo raíz headless para la edición de paradas de degradado.
---

# GradientEditorRoot

`GradientEditorRoot` es un primitivo raíz headless para la edición de degradados.

Gestiona:

- estado de la parada activa
- cambio de subtipo
- lógica de añadir/eliminar/actualizar paradas
- edición del color activo
- fondo de barra derivado

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Valor actual del relleno degradado.', required: true }
  ]"
/>

## Eventos

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Emitido cuando el relleno degradado cambia.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'editor state + handlers', description: 'Contrato completo de renderizado del editor de degradado.' }
  ]"
/>

### Props del slot default

```ts
{
  stops: GradientStop[]
  subtype: GradientSubtype
  subtypes: Array<{ value: GradientSubtype; label: string }>
  activeStopIndex: number
  activeColor: Color
  barBackground: string
  setSubtype: (type: GradientSubtype) => void
  selectStop: (index: number) => void
  addStop: () => void
  removeStop: (index: number) => void
  updateStopPosition: (index: number, position: number) => void
  updateStopColor: (index: number, hex: string) => void
  updateStopOpacity: (index: number, opacity: number) => void
  updateActiveColor: (color: Color) => void
  dragStop: (index: number, position: number) => void
}
```

## Ejemplo

```vue
<GradientEditorRoot :fill="fill" @update="fill = $event" v-slot="ctx">
  <MyGradientUI v-bind="ctx" />
</GradientEditorRoot>
```

## APIs relacionadas

- [GradientEditorBar](./gradient-editor-bar)
- [GradientEditorStop](./gradient-editor-stop)
