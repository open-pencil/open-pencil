---
title: GradientEditorStop
description: Primitivo headless de slot para una sola fila de parada de degradado.
---

# GradientEditorStop

`GradientEditorStop` es un primitivo headless para renderizar y editar una sola parada de degradado.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stop', type: 'GradientStop', description: 'Valor actual de la parada.', required: true },
    { name: 'index', type: 'number', description: 'Índice actual de la parada.', required: true },
    { name: 'active', type: 'boolean', description: 'Si esta parada está activa.', required: true }
  ]"
/>

## Eventos

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'index: number', description: 'Emitido cuando se selecciona la parada.' },
    { name: 'updatePosition', payload: 'index: number, position: number', description: 'Emitido cuando cambia la posición de la parada.' },
    { name: 'updateColor', payload: 'index: number, hex: string', description: 'Emitido cuando cambia el color de la parada.' },
    { name: 'updateOpacity', payload: 'index: number, opacity: number', description: 'Emitido cuando cambia la opacidad de la parada.' },
    { name: 'remove', payload: 'index: number', description: 'Emitido cuando se elimina la parada.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stop state + update handlers', description: 'Contrato completo de renderizado de la parada de degradado.' }
  ]"
/>

### Props del slot default

```ts
{
  stop: GradientStop
  index: number
  active: boolean
  positionPercent: number
  opacityPercent: number
  hex: string
  css: string
  select: () => void
  updatePosition: (position: number) => void
  updateColor: (hex: string) => void
  updateOpacity: (opacity: number) => void
  remove: () => void
}
```

## Ejemplo

```vue
<GradientEditorStop :stop="stop" :index="index" :active="active" v-slot="ctx">
  <MyGradientStopRow v-bind="ctx" />
</GradientEditorStop>
```

## APIs relacionadas

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
