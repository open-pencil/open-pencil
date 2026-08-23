---
title: useI18n
description: Lokalizowane etykiety OpenPencil i zmiana aktywnego locale SDK.
---

# useI18n

`useI18n()` zwraca reaktywne translations i functions zmiany locale dla własnego interfejsu edytora.

Użyj go, aby pobierać etykiety menu, commands, panels, pages i dialogs dostarczane przez SDK albo umożliwić użytkownikowi wybór języka.

## Użycie

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Zwracane wartości

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

## Przykład

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

- Zmiana locale reaktywnie aktualizuje wszystkie groups translations SDK.
- SDK eksportuje również low-level locale API do bezpośredniej pracy ze store.

## Zobacz też

- [useMenuModel](./use-menu-model)
- [Locale API](../advanced/locale-apis)
