---
title: GradientEditorStop
description: Primitive slot headless pour une ligne de point d'arrêt de dégradé individuel.
---

# GradientEditorStop

`GradientEditorStop` est une primitive headless pour afficher et éditer un point d'arrêt de dégradé individuel.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stop', type: 'GradientStop', description: 'Valeur du point d\'arrêt courant.', required: true },
    { name: 'index', type: 'number', description: 'Index du point d\'arrêt courant.', required: true },
    { name: 'active', type: 'boolean', description: 'Si ce point d\'arrêt est actif.', required: true }
  ]"
/>

## Événements

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'index: number', description: 'Émis quand le point d\'arrêt est sélectionné.' },
    { name: 'updatePosition', payload: 'index: number, position: number', description: 'Émis quand la position du point d\'arrêt change.' },
    { name: 'updateColor', payload: 'index: number, hex: string', description: 'Émis quand la couleur du point d\'arrêt change.' },
    { name: 'updateOpacity', payload: 'index: number, opacity: number', description: 'Émis quand l\'opacité du point d\'arrêt change.' },
    { name: 'remove', payload: 'index: number', description: 'Émis quand le point d\'arrêt est supprimé.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'état du point d\'arrêt + handlers de mise à jour', description: 'Contrat de rendu complet du point d\'arrêt de dégradé.' }
  ]"
/>

### Props du slot par défaut

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

## Exemple

```vue
<GradientEditorStop :stop="stop" :index="index" :active="active" v-slot="ctx">
  <MyGradientStopRow v-bind="ctx" />
</GradientEditorStop>
```

## API associées

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
