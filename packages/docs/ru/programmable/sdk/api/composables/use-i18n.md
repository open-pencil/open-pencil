---
title: useI18n
description: Получение переведённых сообщений интерфейса OpenPencil и выбор языка SDK.
---

# useI18n

`useI18n()` возвращает реактивные группы переведённых сообщений и функции для выбора языка интерфейса.

Он нужен, если интерфейс использует подготовленные в SDK подписи для меню, команд, панелей, страниц и диалогов либо позволяет пользователю выбрать язык.

## Использование

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Возвращает

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

## Базовый пример

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

## Примечания

- при смене языка все группы сообщений SDK обновляются автоматически;
- для прямого доступа к хранилищу SDK также экспортирует низкоуровневый locale API.

## Связанные API

- [useMenuModel](./use-menu-model)
- [Locale APIs SDK](../advanced/locale-apis)
