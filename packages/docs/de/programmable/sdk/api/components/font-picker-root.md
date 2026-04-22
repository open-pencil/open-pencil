---
title: FontPickerRoot
description: Headless durchsuchbarer Schrift-Picker basierend auf Reka Combobox.
---

# FontPickerRoot

`FontPickerRoot` ist ein headless durchsuchbares Schrift-Auswahl-Primitiv, das auf Reka UI Combobox-Primitiven aufbaut.

## Props

<SdkPropsTable
  :rows="[
    { name: 'listFamilies', type: '() => Promise<string[]>', description: 'Asynchrone Quelle für verfügbare Schriftfamilien.', required: true },
    { name: 'triggerClass', type: 'string | undefined', description: 'Optionale Klasse für den Standard-Trigger.' },
    { name: 'contentClass', type: 'string | undefined', description: 'Optionale Klasse für Dropdown-Inhalte.' },
    { name: 'itemClass', type: 'string | undefined', description: 'Optionale Klasse für Standard-Elemente.' },
    { name: 'searchClass', type: 'string | undefined', description: 'Optionale Klasse für das Sucheingabefeld.' },
    { name: 'viewportClass', type: 'string | undefined', description: 'Optionale Klasse für den Scroll-Viewport.' },
    { name: 'emptyClass', type: 'string | undefined', description: 'Optionale Klasse für leere Zustände.' },
    { name: 'emptySearchText', type: 'string | undefined', description: 'Text, der angezeigt wird, wenn die Suche keine Schriften zurückgibt.' },
    { name: 'emptyFontsText', type: 'string | undefined', description: 'Text, der angezeigt wird, wenn keine Schriften verfügbar sind.' },
    { name: 'emptyFontsHint', type: 'string | undefined', description: 'Optionaler Hilfstext für den leeren-Schriften-Zustand.' }
  ]"
/>

## Modell

<SdkPropsTable
  :rows="[
    { name: 'v-model', type: 'string', description: 'Ausgewählte Schriftfamilie.', required: true }
  ]"
/>

## Ereignisse

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'family: string', description: 'Ausgelöst, nachdem eine Schriftfamilie ausgewählt wurde.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ value: string, open: boolean }', description: 'Benutzerdefinierter Trigger-Inhalt.' },
    { name: 'search', props: '{ searchTerm: string, setInputRef: (el: HTMLInputElement | null) => void }', description: 'Benutzerdefinierter Sucheingabe-Slot.' },
    { name: 'item', props: '{ family: string, selected: boolean }', description: 'Benutzerdefinierter Element-Renderer.' },
    { name: 'indicator', props: '{ selected: boolean }', description: 'Benutzerdefinierter Auswahl-Indikator.' },
    { name: 'empty', description: 'Wird angezeigt, wenn keine Schriften verfügbar sind.' }
  ]"
/>

## Beispiel

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button class="w-full truncate">{{ value }}</button>
  </template>
</FontPickerRoot>
```

## Verwandte APIs

- [useTypography](../composables/use-typography)
