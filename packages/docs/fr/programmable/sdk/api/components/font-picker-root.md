---
title: FontPickerRoot
description: Sélecteur de police headless avec recherche, basé sur Reka Combobox.
---

# FontPickerRoot

`FontPickerRoot` est un sélecteur de police headless avec recherche, construit sur les primitives Reka UI Combobox.

## Props

<SdkPropsTable
  :rows="[
    { name: 'listFamilies', type: '() => Promise<string[]>', description: 'Source asynchrone des familles de polices disponibles.', required: true },
    { name: 'triggerClass', type: 'string | undefined', description: 'Classe optionnelle pour le déclencheur par défaut.' },
    { name: 'contentClass', type: 'string | undefined', description: 'Classe optionnelle pour le contenu déroulant.' },
    { name: 'itemClass', type: 'string | undefined', description: 'Classe optionnelle pour les éléments par défaut.' },
    { name: 'searchClass', type: 'string | undefined', description: 'Classe optionnelle pour le champ de recherche.' },
    { name: 'viewportClass', type: 'string | undefined', description: 'Classe optionnelle pour le viewport de défilement.' },
    { name: 'emptyClass', type: 'string | undefined', description: 'Classe optionnelle pour les états vides.' },
    { name: 'emptySearchText', type: 'string | undefined', description: 'Texte affiché quand la recherche ne retourne aucune police.' },
    { name: 'emptyFontsText', type: 'string | undefined', description: 'Texte affiché quand aucune police n\'est disponible.' },
    { name: 'emptyFontsHint', type: 'string | undefined', description: 'Texte d\'aide optionnel pour l\'état sans polices.' }
  ]"
/>

## Modèle

<SdkPropsTable
  :rows="[
    { name: 'v-model', type: 'string', description: 'Famille de polices sélectionnée.', required: true }
  ]"
/>

## Événements

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'family: string', description: 'Émis après la sélection d\'une famille de polices.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ value: string, open: boolean }', description: 'Contenu du déclencheur personnalisé.' },
    { name: 'search', props: '{ searchTerm: string, setInputRef: (el: HTMLInputElement | null) => void }', description: 'Slot de champ de recherche personnalisé.' },
    { name: 'item', props: '{ family: string, selected: boolean }', description: 'Rendu d\'élément personnalisé.' },
    { name: 'indicator', props: '{ selected: boolean }', description: 'Indicateur de sélection personnalisé.' },
    { name: 'empty', description: 'Affiché quand aucune police n\'est disponible.' }
  ]"
/>

## Exemple

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button class="w-full truncate">{{ value }}</button>
  </template>
</FontPickerRoot>
```

## API associées

- [useTypography](../composables/use-typography)
