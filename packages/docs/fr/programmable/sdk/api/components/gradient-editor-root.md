---
title: GradientEditorRoot
description: Primitive racine headless pour l'édition de points d'arrêt de dégradé.
---

# GradientEditorRoot

`GradientEditorRoot` est une primitive racine headless pour l'édition de dégradés.

Elle gère :

- l'état du point d'arrêt actif
- le changement de sous-type
- la logique d'ajout/suppression/mise à jour des points d'arrêt
- l'édition de la couleur active
- le fond de barre dérivé

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Valeur du remplissage dégradé courant.', required: true }
  ]"
/>

## Événements

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Émis quand le remplissage dégradé change.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'état de l\'éditeur + handlers', description: 'Contrat de rendu complet de l\'éditeur de dégradé.' }
  ]"
/>

### Props du slot par défaut

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

## Exemple

```vue
<GradientEditorRoot :fill="fill" @update="fill = $event" v-slot="ctx">
  <MyGradientUI v-bind="ctx" />
</GradientEditorRoot>
```

## API associées

- [GradientEditorBar](./gradient-editor-bar)
- [GradientEditorStop](./gradient-editor-stop)
