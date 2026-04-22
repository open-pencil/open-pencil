---
title: ScrubInputRoot
description: Primitive racine headless pour la saisie numérique par glissement.
---

# ScrubInputRoot

`ScrubInputRoot` est la primitive racine headless pour la saisie numérique par glissement.

Elle gère :

- l'affichage des valeurs mixtes
- l'état d'édition versus de glissement
- le glissement numérique piloté par le pointeur
- la sémantique de validation pour les éditions terminées

## Props

<SdkPropsTable
  :rows="[
    { name: 'modelValue', type: 'number | symbol', description: 'Valeur numérique courante ou sentinelle de valeur mixte.', required: true },
    { name: 'min', type: 'number | undefined', description: 'Valeur minimale autorisée.', default: '-Infinity' },
    { name: 'max', type: 'number | undefined', description: 'Valeur maximale autorisée.', default: 'Infinity' },
    { name: 'step', type: 'number | undefined', description: 'Multiplicateur de pas de glissement.', default: '1' },
    { name: 'sensitivity', type: 'number | undefined', description: 'Multiplicateur de sensibilité du pointeur.', default: '1' },
    { name: 'placeholder', type: 'string | undefined', description: 'Placeholder pour les valeurs mixtes.', default: 'Mixed' }
  ]"
/>

## Modèle

<SdkPropsTable
  :rows="[
    { name: 'v-model:modelValue', type: 'number', description: 'Modèle numérique inscriptible.', required: true }
  ]"
/>

## Événements

<SdkEventsTable
  :rows="[
    { name: 'update:modelValue', payload: 'value: number', description: 'Émis pendant le glissement ou l\'édition.' },
    { name: 'commit', payload: 'value: number, previous: number', description: 'Émis quand une interaction d\'édition est validée.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ modelValue: number | symbol, displayValue: string, isMixed: boolean, editing: boolean, scrubbing: boolean, startScrub: (event: PointerEvent) => void, startEdit: () => void, commitEdit: (event: Event) => void, keydown: (event: KeyboardEvent) => void, placeholder: string }', description: 'Contrat de rendu complet de la saisie par glissement.' }
  ]"
/>

## Exemple

```vue
<ScrubInputRoot v-model:model-value="value" @commit="commit" v-slot="ctx">
  <div @pointerdown="ctx.startScrub">
    <ScrubInputDisplay />
    <ScrubInputField class="w-16" />
  </div>
</ScrubInputRoot>
```

## API associées

- [ScrubInputField](./scrub-input-field)
- [ScrubInputDisplay](./scrub-input-display)
