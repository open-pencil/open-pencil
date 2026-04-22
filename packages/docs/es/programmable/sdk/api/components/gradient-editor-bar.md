---
title: GradientEditorBar
description: Primitivo de barra arrastrable headless para las paradas de degradado.
---

# GradientEditorBar

`GradientEditorBar` es el primitivo de barra arrastrable usado dentro de los editores de degradado.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stops', type: 'GradientStop[]', description: 'Paradas de degradado actuales.', required: true },
    { name: 'activeStopIndex', type: 'number', description: 'Índice de la parada activa.', required: true },
    { name: 'barBackground', type: 'string', description: 'Cadena CSS de fondo para la barra.', required: true }
  ]"
/>

## Eventos

<SdkEventsTable
  :rows="[
    { name: 'selectStop', payload: 'index: number', description: 'Emitido cuando se selecciona una parada.' },
    { name: 'dragStop', payload: 'index: number, position: number', description: 'Emitido mientras se arrastra una parada.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'bar state + drag handlers', description: 'Contrato completo de renderizado de la barra de degradado.' }
  ]"
/>

### Props del slot default

```ts
{
  stops: GradientStop[]
  activeStopIndex: number
  barBackground: string
  barRef: (el: unknown) => void
  onStopPointerDown: (index: number, event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: () => void
  draggingIndex: number | null
}
```

## Ejemplo

```vue
<GradientEditorBar
  :stops="stops"
  :active-stop-index="activeStopIndex"
  :bar-background="barBackground"
  @select-stop="selectStop"
  @drag-stop="dragStop"
  v-slot="ctx"
>
  <MyGradientBar v-bind="ctx" />
</GradientEditorBar>
```

## APIs relacionadas

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
