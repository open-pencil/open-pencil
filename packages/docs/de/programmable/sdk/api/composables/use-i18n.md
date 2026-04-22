---
title: useI18n
description: Lokalisierte OpenPencil-UI-Nachrichten lesen und die aktive SDK-Locale wechseln.
---

# useI18n

`useI18n()` gibt reaktive Übersetzungsgruppen sowie Locale-Steuerelemente für OpenPencil-gestützte Editor-Shells zurück.

Verwenden Sie es, wenn Sie SDK-gestützte Beschriftungen für Menüs, Befehle, Panels, Seiten und Dialoge möchten, oder wenn Sie Benutzern ermöglichen möchten, Locales zu wechseln.

## Verwendung

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Rückgabewerte

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

## Einfaches Beispiel

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

- Locale-Wechsel sind über alle SDK-Nachrichtengruppen reaktiv
- das SDK exportiert auch Locale-Primitive auf niedrigerem Level, wenn Sie direkten Store-Zugriff benötigen

## Verwandte APIs

- [useMenuModel](./use-menu-model)
- [SDK Locale APIs](../advanced/locale-apis)
