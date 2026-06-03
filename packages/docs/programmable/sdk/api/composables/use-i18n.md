---
title: useI18n
description: Read localized Inkly UI messages and switch the active SDK locale.
---

# useI18n

`useI18n()` returns reactive translation groups plus locale controls for Inkly-powered editor shells.

Use it when you want SDK-backed labels for menus, commands, panels, pages, and dialogs, or when you need to let users switch locales.

## Usage

```ts
import { useI18n } from '@inkly/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Returns

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

## Basic example

```vue
<script setup lang="ts">
import { useI18n } from '@inkly/vue'

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

## Notes

- locale changes are reactive across all SDK message groups
- the SDK also exports lower-level locale primitives when you need direct store access

## Related APIs

- [useMenuModel](./use-menu-model)
- [SDK Locale APIs](../advanced/locale-apis)
