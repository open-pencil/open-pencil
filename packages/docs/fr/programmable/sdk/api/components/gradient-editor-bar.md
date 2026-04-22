---
title: GradientEditorBar
description: Primitive de barre déplaçable headless pour les points d'arrêt de dégradé.
---

# GradientEditorBar

`GradientEditorBar` est la primitive de barre déplaçable utilisée dans les éditeurs de dégradé.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stops', type: 'GradientStop[]', description: 'Points d\'arrêt de dégradé courants.', required: true },
    { name: 'activeStopIndex', type: 'number', description: 'Index du point d\'arrêt actif.', required: true },
    { name: 'barBackground', type: 'string', description: 'Chaîne CSS de fond pour la barre.', required: true }
  ]"
/>

## Événements

<SdkEventsTable
  :rows="[
    { name: 'selectStop', payload: 'index: number', description: 'Émis quand un point d\'arrêt est sélectionné.' },
    { name: 'dragStop', payload: 'index: number, position: number', description: 'Émis pendant le déplacement d\'un point d\'arrêt.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'état de la barre + handlers de déplacement', description: 'Contrat de rendu complet de la barre de dégradé.' }
  ]"
/>

### Props du slot par défaut

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

## Exemple

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

## API associées

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
