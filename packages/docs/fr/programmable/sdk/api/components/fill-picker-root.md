---
title: FillPickerRoot
description: Primitive headless de sélecteur de remplissage basé sur un popover.
---

# FillPickerRoot

`FillPickerRoot` est une primitive headless de sélecteur de remplissage basé sur un popover pour les remplissages solides, dégradés et images.

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Valeur de remplissage courante.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Classe optionnelle pour le contenu du popover.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Classe optionnelle pour le bouton déclencheur par défaut.' }
  ]"
/>

## Événements

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Émis quand le remplissage change.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: 'style de l\'échantillon', description: 'Déclencheur personnalisé avec le style de fond de l\'échantillon.' },
    { name: 'default', props: 'état du remplissage + helpers de conversion', description: 'Contenu principal de l\'éditeur de remplissage.' }
  ]"
/>

### Props du slot déclencheur

```ts
{
  style: Record<string, string>
}
```

### Props du slot par défaut

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

## Exemple

```vue
<FillPickerRoot :fill="fill" @update="fill = $event">
  <template #default="{ fill, category, toSolid, toGradient, update }">
    <div>{{ category }}</div>
    <button @click="toSolid">Solide</button>
    <button @click="toGradient">Dégradé</button>
    <MyFillEditor :fill="fill" @change="update" />
  </template>
</FillPickerRoot>
```

## API associées

- [GradientEditorRoot](./gradient-editor-root)
