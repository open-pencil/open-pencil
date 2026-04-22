---
title: GradientEditorBar
description: Primitiva barra trascinabile headless per gli stop del gradiente.
---

# GradientEditorBar

`GradientEditorBar` è la primitiva barra trascinabile usata all'interno degli editor di gradienti.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stops', type: 'GradientStop[]', description: 'Stop del gradiente correnti.', required: true },
    { name: 'activeStopIndex', type: 'number', description: 'Indice dello stop attivo.', required: true },
    { name: 'barBackground', type: 'string', description: 'Stringa CSS di sfondo per la barra.', required: true }
  ]"
/>

## Eventi

<SdkEventsTable
  :rows="[
    { name: 'selectStop', payload: 'index: number', description: 'Emesso quando uno stop viene selezionato.' },
    { name: 'dragStop', payload: 'index: number, position: number', description: 'Emesso mentre uno stop viene trascinato.' }
  ]"
/>

## Slot

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stato barra + handler di trascinamento', description: 'Contratto di rendering completo per la barra del gradiente.' }
  ]"
/>

### Slot prop predefiniti

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

## Esempio

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

## API correlate

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
