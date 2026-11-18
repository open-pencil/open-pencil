---
title: FontPickerRoot
description: Компонент выбора шрифта с поиском на основе Reka UI Combobox.
---

# FontPickerRoot

`FontPickerRoot` предоставляет поиск и асинхронный список семейств шрифтов без навязанного оформления. Компонент построен на Reka UI Combobox; приложение может заменить кнопку открытия, поле поиска, строки списка, отметку выбора и пустое состояние через слоты.

## Props

<SdkPropsTable
  :rows="[
    { name: 'listFamilies', type: '() => Promise<string[]>', description: 'Асинхронный источник доступных семейств шрифтов.', required: true },
    { name: 'triggerClass', type: 'string | undefined', description: 'Необязательный класс стандартной кнопки открытия.' },
    { name: 'contentClass', type: 'string | undefined', description: 'Необязательный класс содержимого списка.' },
    { name: 'itemClass', type: 'string | undefined', description: 'Необязательный класс строк списка.' },
    { name: 'searchClass', type: 'string | undefined', description: 'Необязательный класс поля поиска.' },
    { name: 'viewportClass', type: 'string | undefined', description: 'Необязательный класс прокручиваемой области.' },
    { name: 'emptyClass', type: 'string | undefined', description: 'Необязательный класс пустого состояния.' },
    { name: 'emptySearchText', type: 'string | undefined', description: 'Текст, когда поиск не дал результатов.' },
    { name: 'emptyFontsText', type: 'string | undefined', description: 'Текст, когда шрифты недоступны.' },
    { name: 'emptyFontsHint', type: 'string | undefined', description: 'Дополнительная подсказка при отсутствии шрифтов.' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model', type: 'string', description: 'Выбранное семейство шрифта.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'family: string', description: 'Вызывается после выбора семейства.' }
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

## См. также

- [useTypography](../composables/use-typography)
