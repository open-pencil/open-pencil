---
title: FontPickerRoot
description: Bezstanowy przeszukiwalny selektor czcionek zbudowany na Reka Combobox.
---

# FontPickerRoot

`FontPickerRoot` to bezstanowy przeszukiwalny selektor czcionek zbudowany na prymitywach Reka UI Combobox.

## Props

<SdkPropsTable
  :rows="[
    { name: 'listFamilies', type: '() => Promise<string[]>', description: 'Asynchroniczne źródło dostępnych rodzin czcionek.', required: true },
    { name: 'triggerClass', type: 'string | undefined', description: 'Opcjonalna klasa dla domyślnego wyzwalacza.' },
    { name: 'contentClass', type: 'string | undefined', description: 'Opcjonalna klasa dla zawartości listy rozwijanej.' },
    { name: 'itemClass', type: 'string | undefined', description: 'Opcjonalna klasa dla domyślnych elementów.' },
    { name: 'searchClass', type: 'string | undefined', description: 'Opcjonalna klasa dla pola wejściowego wyszukiwania.' },
    { name: 'viewportClass', type: 'string | undefined', description: 'Opcjonalna klasa dla obszaru przewijania.' },
    { name: 'emptyClass', type: 'string | undefined', description: 'Opcjonalna klasa dla stanów pustych.' },
    { name: 'emptySearchText', type: 'string | undefined', description: 'Tekst wyświetlany gdy wyszukiwanie nie zwraca czcionek.' },
    { name: 'emptyFontsText', type: 'string | undefined', description: 'Tekst wyświetlany gdy brak dostępnych czcionek.' },
    { name: 'emptyFontsHint', type: 'string | undefined', description: 'Opcjonalny tekst pomocniczy dla stanu braku czcionek.' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model', type: 'string', description: 'Wybrana rodzina czcionek.', required: true }
  ]"
/>

## Zdarzenia

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'family: string', description: 'Emitowane po wyborze rodziny czcionek.' }
  ]"
/>

## Sloty

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ value: string, open: boolean }', description: 'Niestandardowa zawartość wyzwalacza.' },
    { name: 'search', props: '{ searchTerm: string, setInputRef: (el: HTMLInputElement | null) => void }', description: 'Niestandardowy slot pola wejściowego wyszukiwania.' },
    { name: 'item', props: '{ family: string, selected: boolean }', description: 'Niestandardowy renderer elementu.' },
    { name: 'indicator', props: '{ selected: boolean }', description: 'Niestandardowy wskaźnik zaznaczenia.' },
    { name: 'empty', description: 'Wyświetlany gdy brak dostępnych czcionek.' }
  ]"
/>

## Przykład

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button class="w-full truncate">{{ value }}</button>
  </template>
</FontPickerRoot>
```

## Powiązane API

- [useTypography](../composables/use-typography)
