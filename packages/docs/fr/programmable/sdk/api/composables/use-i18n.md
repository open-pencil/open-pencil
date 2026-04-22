---
title: useI18n
description: Lit les messages de l'UI OpenPencil localisés et change la locale active du SDK.
---

# useI18n

`useI18n()` retourne des groupes de traduction réactifs ainsi que des contrôles de locale pour les shells d'éditeur propulsés par OpenPencil.

Utilisez-le quand vous voulez des libellés fournis par le SDK pour les menus, commandes, panneaux, pages et dialogues, ou quand vous devez permettre aux utilisateurs de changer de locale.

## Utilisation

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Retourne

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

## Exemple de base

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

## Notes

- les changements de locale sont réactifs dans tous les groupes de messages du SDK
- le SDK exporte aussi des primitives de locale de plus bas niveau quand vous avez besoin d'un accès direct au store

## API associées

- [useMenuModel](./use-menu-model)
- [API Locale SDK](../advanced/locale-apis)
