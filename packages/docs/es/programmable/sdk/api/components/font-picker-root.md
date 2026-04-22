---
title: FontPickerRoot
description: Selector de fuente headless con búsqueda construido sobre Reka Combobox.
---

# FontPickerRoot

`FontPickerRoot` es un selector de fuente headless con búsqueda construido sobre los primitivos Combobox de Reka UI.

## Props

<SdkPropsTable
  :rows="[
    { name: 'listFamilies', type: '() => Promise<string[]>', description: 'Fuente asíncrona de las familias tipográficas disponibles.', required: true },
    { name: 'triggerClass', type: 'string | undefined', description: 'Clase opcional para el trigger por defecto.' },
    { name: 'contentClass', type: 'string | undefined', description: 'Clase opcional para el contenido desplegable.' },
    { name: 'itemClass', type: 'string | undefined', description: 'Clase opcional para los elementos por defecto.' },
    { name: 'searchClass', type: 'string | undefined', description: 'Clase opcional para el input de búsqueda.' },
    { name: 'viewportClass', type: 'string | undefined', description: 'Clase opcional para el viewport de scroll.' },
    { name: 'emptyClass', type: 'string | undefined', description: 'Clase opcional para los estados vacíos.' },
    { name: 'emptySearchText', type: 'string | undefined', description: 'Texto mostrado cuando la búsqueda no devuelve fuentes.' },
    { name: 'emptyFontsText', type: 'string | undefined', description: 'Texto mostrado cuando no hay fuentes disponibles.' },
    { name: 'emptyFontsHint', type: 'string | undefined', description: 'Texto de ayuda opcional para el estado de fuentes vacío.' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model', type: 'string', description: 'Familia tipográfica seleccionada.', required: true }
  ]"
/>

## Eventos

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'family: string', description: 'Emitido tras seleccionar una familia tipográfica.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ value: string, open: boolean }', description: 'Contenido del trigger personalizado.' },
    { name: 'search', props: '{ searchTerm: string, setInputRef: (el: HTMLInputElement | null) => void }', description: 'Slot del input de búsqueda personalizado.' },
    { name: 'item', props: '{ family: string, selected: boolean }', description: 'Renderer de elemento personalizado.' },
    { name: 'indicator', props: '{ selected: boolean }', description: 'Indicador de seleccionado personalizado.' },
    { name: 'empty', description: 'Se muestra cuando no hay fuentes disponibles.' }
  ]"
/>

## Ejemplo

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button class="w-full truncate">{{ value }}</button>
  </template>
</FontPickerRoot>
```

## APIs relacionadas

- [useTypography](../composables/use-typography)
