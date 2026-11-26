---
title: useMessages
description: Read localized OpenPencil UI messages and switch the active SDK locale.
---

# useMessages

`useMessages(namespace)` returns one namespace's messages in the current locale, as a reactive ref. A namespace is named by the path of its catalog, so `'panels/pickers'` is `messages/panels/pickers.ts` in the SDK, with each locale's translations in `locales/<locale>/panels/pickers.json`.

```ts twoslash
import { useMessages } from '@open-pencil/vue/i18n'

const settings = useMessages('settings')
const pickers = useMessages('panels/pickers')
```

Read `.value` in script; Vue unwraps the ref in templates. `MessageNamespace` lists every namespace, and `MessagesOf<'settings'>` is the type of one namespace's messages, for helpers that take them as an argument.

Outside a component, read a namespace's store from `messageStores`: `messageStores.files.get()`.

## Locale

`useLocale()` returns the active locale, the locales the SDK translates, their names in their own language, and `setLocale()`.

```vue
<script setup lang="ts">
import { useLocale, useMessages } from '@open-pencil/vue/i18n'

const menu = useMessages('menu')
const { locale, availableLocales, localeLabels, setLocale } = useLocale()
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

- locale changes are reactive across every namespace
- a locale's translations load together the first time it is used, so every namespace switches at once
- the SDK also exports lower-level locale primitives when you need direct store access

## Related APIs

- [useMenuModel](./use-menu-model)
- [SDK Locale APIs](../advanced/locale-apis)
