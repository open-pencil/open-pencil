---
title: ColorInputRoot
description: Helper headless pour la saisie de couleur avec analyse hexadécimale et helpers de mise à jour.
---

# ColorInputRoot

`ColorInputRoot` est un helper headless pour les interfaces de saisie de couleur.

Il dérive une valeur hexadécimale d'une couleur et expose des helpers de mise à jour pour les changements hexadécimaux et de couleur complète.

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Valeur de couleur courante.', required: true },
    { name: 'editable', type: 'boolean | undefined', description: 'Si le consommateur doit présenter la valeur comme modifiable.' }
  ]"
/>

## Événements

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Émis quand la couleur change.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ color: Color, editable: boolean, hex: string, updateFromHex: (value: string) => void, updateColor: (color: Color) => void }', description: 'Contrat de rendu principal de la saisie de couleur.' }
  ]"
/>

## Exemple

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## API associées

- [ColorPickerRoot](./color-picker-root)
