---
title: useI18n
description: Leggi i messaggi UI OpenPencil localizzati e cambia la lingua attiva dell'SDK.
---

# useI18n

`useI18n()` restituisce gruppi di traduzione reattivi e controlli della lingua per le shell editor basate su OpenPencil.

Usalo quando vuoi etichette supportate dall'SDK per menu, comandi, pannelli, pagine e dialoghi, o quando vuoi consentire agli utenti di cambiare la lingua.

## Utilizzo

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Restituisce

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

## Esempio base

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

## Note

- i cambiamenti di lingua sono reattivi in tutti i gruppi di messaggi dell'SDK
- l'SDK esporta anche primitive di locale di livello inferiore quando hai bisogno di accesso diretto allo store

## API correlate

- [useMenuModel](./use-menu-model)
- [API Locale SDK](../advanced/locale-apis)
