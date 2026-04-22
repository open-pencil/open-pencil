---
title: GradientEditorRoot
description: Primitiva root headless per la modifica degli stop del gradiente.
---

# GradientEditorRoot

`GradientEditorRoot` è una primitiva root headless per la modifica dei gradienti.

Gestisce:

- lo stato dello stop attivo
- il cambio di sottotipo
- la logica di aggiunta/rimozione/aggiornamento degli stop
- la modifica del colore attivo
- lo sfondo della barra derivato

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Valore riempimento gradiente corrente.', required: true }
  ]"
/>

## Eventi

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Emesso quando il riempimento gradiente cambia.' }
  ]"
/>

## Slot

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stato editor + handler', description: 'Contratto di rendering completo per l\'editor del gradiente.' }
  ]"
/>

### Slot prop predefiniti

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

## Esempio

```vue
<GradientEditorRoot :fill="fill" @update="fill = $event" v-slot="ctx">
  <MyGradientUI v-bind="ctx" />
</GradientEditorRoot>
```

## API correlate

- [GradientEditorBar](./gradient-editor-bar)
- [GradientEditorStop](./gradient-editor-stop)
