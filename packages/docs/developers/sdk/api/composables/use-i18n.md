---
title: useI18n
description: Read localized OpenPencil UI messages and switch the active SDK locale.
---

# useI18n

`useI18n()` is a compatibility aggregate returning reactive translation groups and locale controls. New components should import only the product-domain composables they need, rather than subscribe to every catalog.

```ts twoslash
import { useSettingsMessages, useRenameMessages } from '@open-pencil/vue/i18n'

const settings = useSettingsMessages()
const rename = useRenameMessages()
```

Each domain composable returns a reactive ref. Read `.value` in script; Vue unwraps it in templates. See [Locale APIs](../advanced/locale-apis) for locale switching without the aggregate.

## Usage

```ts
import { useI18n } from '@open-pencil/vue/i18n'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Returns

Translation refs: `ai`, `automation`, `code`, `collaboration`, `commands`, `common`, `credentials`, `diagnostics`, `editor`, `files`, `fonts`, `media`, `menu`, `pages`, `panels`, `recovery`, `rendering`, `rename`, `settings`, `storage`, `tools`, `updates`, `variables`, and `variableTypes`.

Locale controls: `locale`, `availableLocales`, `localeLabels`, and `setLocale`.

The former `dialogs` group, `useDialogMessages()`, and `dialogMessages` are removed in the development version after v0.14.0. Use the owning domain, such as `settings`, `rename`, or `recovery`, and update the corresponding message keys.

## Basic example

```vue
<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

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
