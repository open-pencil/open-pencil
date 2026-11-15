---
title: FontPickerRoot
description: Headless searchable font picker built on Reka Combobox.
---

# FontPickerRoot

`FontPickerRoot` is a headless searchable font picker built on Reka UI Combobox primitives.

## Props

<SdkPropsTable
  :rows="[
    { name: 'listFamilies', type: '() => Promise<string[]>', description: 'Async source for available font families.', required: true },
    { name: 'triggerClass', type: 'string | undefined', description: 'Optional class for the default trigger.' },
    { name: 'contentClass', type: 'string | undefined', description: 'Optional class for dropdown content.' },
    { name: 'itemClass', type: 'string | undefined', description: 'Optional class for default items.' },
    { name: 'searchClass', type: 'string | undefined', description: 'Optional class for the search input.' },
    { name: 'viewportClass', type: 'string | undefined', description: 'Optional class for the scroll viewport.' },
    { name: 'emptyClass', type: 'string | undefined', description: 'Optional class for empty states.' },
    { name: 'emptySearchText', type: 'string | undefined', description: 'Text shown when search returns no fonts.' },
    { name: 'emptyFontsText', type: 'string | undefined', description: 'Text shown when no fonts are available.' },
    { name: 'emptyFontsHint', type: 'string | undefined', description: 'Optional helper text for the empty-fonts state.' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model', type: 'string', description: 'Selected font family.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'family: string', description: 'Emitted after a font family is selected.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ value: string, open: boolean }', description: 'Custom trigger content.' },
    { name: 'search', props: '{ searchTerm: string, setInputRef: (el: HTMLInputElement | null) => void }', description: 'Custom search input slot.' },
    { name: 'item', props: '{ family: string, selected: boolean }', description: 'Custom item renderer.' },
    { name: 'indicator', props: '{ selected: boolean }', description: 'Custom selected indicator.' },
    { name: 'empty', description: 'Shown when no fonts are available.' }
  ]"
/>

## Example

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button class="w-full truncate">{{ value }}</button>
  </template>
</FontPickerRoot>
```

## Related APIs

- [useTypography](../composables/use-typography)
