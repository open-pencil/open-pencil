---
title: useI18n
description: Чтение локализованных сообщений интерфейса OpenPencil и переключение активной локали SDK.
---

# useI18n

`useI18n()` возвращает реактивные группы переводов и элементы управления локалью для оболочек редактора на базе OpenPencil.

Используйте его, когда нужны метки меню, команд, панелей, страниц и диалогов, поддерживаемые SDK, или когда нужно позволить пользователям переключать локаль.

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

- изменения локали реактивно распространяются на все группы сообщений SDK
- SDK также экспортирует низкоуровневые примитивы локали для прямого доступа к хранилищу

## Связанные API

- [useMenuModel](./use-menu-model)
- [Locale APIs SDK](../advanced/locale-apis)
