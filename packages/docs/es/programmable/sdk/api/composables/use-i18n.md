---
title: useI18n
description: Lee los mensajes de UI localizados de OpenPencil y cambia el idioma activo del SDK.
---

# useI18n

`useI18n()` devuelve grupos de traducción reactivos más controles de idioma para los shells de editor potenciados por OpenPencil.

Úsalo cuando quieras etiquetas respaldadas por el SDK para menús, comandos, paneles, páginas y diálogos, o cuando necesites que los usuarios puedan cambiar de idioma.

## Uso

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Devuelve

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

## Ejemplo básico

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

## Notas

- los cambios de idioma son reactivos en todos los grupos de mensajes del SDK
- el SDK también exporta primitivos de idioma de más bajo nivel cuando necesitas acceso directo al store

## APIs relacionadas

- [useMenuModel](./use-menu-model)
- [APIs de Idioma del SDK](../advanced/locale-apis)
