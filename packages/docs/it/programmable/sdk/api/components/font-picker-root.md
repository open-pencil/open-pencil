---
title: FontPickerRoot
description: Selettore font searchable headless basato su Reka Combobox.
---

# FontPickerRoot

`FontPickerRoot` è un selettore font searchable headless basato sulle primitive Reka UI Combobox.

## Props

<SdkPropsTable
  :rows="[
    { name: 'listFamilies', type: '() => Promise<string[]>', description: 'Sorgente asincrona per le famiglie di font disponibili.', required: true },
    { name: 'triggerClass', type: 'string | undefined', description: 'Classe opzionale per il trigger predefinito.' },
    { name: 'contentClass', type: 'string | undefined', description: 'Classe opzionale per il contenuto del dropdown.' },
    { name: 'itemClass', type: 'string | undefined', description: 'Classe opzionale per gli elementi predefiniti.' },
    { name: 'searchClass', type: 'string | undefined', description: 'Classe opzionale per il campo di ricerca.' },
    { name: 'viewportClass', type: 'string | undefined', description: 'Classe opzionale per il viewport di scorrimento.' },
    { name: 'emptyClass', type: 'string | undefined', description: 'Classe opzionale per gli stati vuoti.' },
    { name: 'emptySearchText', type: 'string | undefined', description: 'Testo mostrato quando la ricerca non restituisce font.' },
    { name: 'emptyFontsText', type: 'string | undefined', description: 'Testo mostrato quando non ci sono font disponibili.' },
    { name: 'emptyFontsHint', type: 'string | undefined', description: 'Testo helper opzionale per lo stato senza font.' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model', type: 'string', description: 'Famiglia di font selezionata.', required: true }
  ]"
/>

## Eventi

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'family: string', description: 'Emesso dopo la selezione di una famiglia di font.' }
  ]"
/>

## Slot

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ value: string, open: boolean }', description: 'Contenuto trigger personalizzato.' },
    { name: 'search', props: '{ searchTerm: string, setInputRef: (el: HTMLInputElement | null) => void }', description: 'Slot input di ricerca personalizzato.' },
    { name: 'item', props: '{ family: string, selected: boolean }', description: 'Renderer elemento personalizzato.' },
    { name: 'indicator', props: '{ selected: boolean }', description: 'Indicatore di selezione personalizzato.' },
    { name: 'empty', description: 'Mostrato quando non ci sono font disponibili.' }
  ]"
/>

## Esempio

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button class="w-full truncate">{{ value }}</button>
  </template>
</FontPickerRoot>
```

## API correlate

- [useTypography](../composables/use-typography)
