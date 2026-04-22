---
title: useI18n
description: Odczytuj zlokalizowane komunikaty UI OpenPencil i przełączaj aktywny język SDK.
---

# useI18n

`useI18n()` zwraca reaktywne grupy tłumaczeń oraz kontrolki języka dla powłok edytora opartych na OpenPencil.

Użyj go, gdy chcesz etykiety wspierane przez SDK dla menu, poleceń, paneli, stron i okien dialogowych, lub gdy chcesz pozwolić użytkownikom na przełączanie języków.

## Użycie

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Zwraca

- `menu`
- `commands`
- `tools`
- `panels`
- `pages`
- `dialogs`
- `locale`
- `availableLocales`
- `localeLabels`
- `setLocale`

## Podstawowy przykład

```vue
<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

const { menu, locale, availableLocales, localeLabels, setLocale } = useI18n()
</script>

<template>
  <label class="flex items-center gap-2">
    <span>{{ menu.view }}</span>
    <select :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value as typeof locale)">
      <option v-for="code in availableLocales" :key="code" :value="code">
        {{ localeLabels[code] }}
      </option>
    </select>
  </label>
</template>
```

## Uwagi

- zmiany języka są reaktywne we wszystkich grupach komunikatów SDK
- SDK eksportuje również prymitywy języka niższego poziomu, gdy potrzebujesz bezpośredniego dostępu do store'a

## Powiązane API

- [useMenuModel](./use-menu-model)
- [API języka SDK](../advanced/locale-apis)
