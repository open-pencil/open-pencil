---
title: FontPickerRoot
description: Headless-пикер шрифта с поиском, построенный на Reka Combobox.
---

# FontPickerRoot

`FontPickerRoot` — headless-пикер шрифта с поиском, построенный на примитивах Reka UI Combobox.

## Props

<SdkPropsTable
  :rows="[
    { name: 'listFamilies', type: '() => Promise<string[]>', description: 'Асинхронный источник доступных семейств шрифтов.', required: true },
    { name: 'triggerClass', type: 'string | undefined', description: 'Опциональный класс для триггера по умолчанию.' },
    { name: 'contentClass', type: 'string | undefined', description: 'Опциональный класс для содержимого выпадающего списка.' },
    { name: 'itemClass', type: 'string | undefined', description: 'Опциональный класс для элементов по умолчанию.' },
    { name: 'searchClass', type: 'string | undefined', description: 'Опциональный класс для поля поиска.' },
    { name: 'viewportClass', type: 'string | undefined', description: 'Опциональный класс для области прокрутки.' },
    { name: 'emptyClass', type: 'string | undefined', description: 'Опциональный класс для состояний «пусто».' },
    { name: 'emptySearchText', type: 'string | undefined', description: 'Текст, отображаемый при отсутствии результатов поиска.' },
    { name: 'emptyFontsText', type: 'string | undefined', description: 'Текст, отображаемый при отсутствии доступных шрифтов.' },
    { name: 'emptyFontsHint', type: 'string | undefined', description: 'Опциональный вспомогательный текст для состояния «нет шрифтов».' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model', type: 'string', description: 'Выбранное семейство шрифтов.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'family: string', description: 'Генерируется после выбора семейства шрифтов.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ value: string, open: boolean }', description: 'Кастомное содержимое триггера.' },
    { name: 'search', props: '{ searchTerm: string, setInputRef: (el: HTMLInputElement | null) => void }', description: 'Слот кастомного поля поиска.' },
    { name: 'item', props: '{ family: string, selected: boolean }', description: 'Кастомный рендерер элемента.' },
    { name: 'indicator', props: '{ selected: boolean }', description: 'Кастомный индикатор выбранного элемента.' },
    { name: 'empty', description: 'Отображается при отсутствии доступных шрифтов.' }
  ]"
/>

## Пример

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button class="w-full truncate">{{ value }}</button>
  </template>
</FontPickerRoot>
```

## Связанные API

- [useTypography](../composables/use-typography)
