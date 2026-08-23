---
title: useI18n
description: Lokalisierte Labels von OpenPencil lesen und das aktive SDK locale ändern.
---

# useI18n

`useI18n()` gibt reaktive Translations und Functions zum Wechseln des Locale zurück.

Das composable stellt Labels für Menüs, Commands, Tools, Panels, Pages und Dialogs bereit und kann einen eigenen Locale picker versorgen.

## Verwendung

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Values

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

## Beispiel

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

## Hinweise

- Ein Locale change aktualisiert alle Translation groups des SDK reaktiv.
- Für direkten Zugriff auf den Store exportiert das SDK außerdem ein low-level Locale API.

## Siehe auch

- [useMenuModel](./use-menu-model)
- [Locale API](../advanced/locale-apis)
