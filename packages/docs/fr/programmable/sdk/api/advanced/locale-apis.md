---
title: API Locale
description: Stores de locale de bas niveau et métadonnées exportés par @open-pencil/vue.
---

# API Locale

En plus de `useI18n()`, le Vue SDK exporte des primitives de locale de bas niveau pour les intégrations avancées :

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Utilisez-les quand vous voulez un accès direct au store, que vous devez intégrer l'état de locale avec un shell applicatif plus large, ou que vous souhaitez les métadonnées de locale sans vous abonner à l'objet de retour complet de `useI18n()`.

## Utilisation

```ts
import {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  LOCALE_LABELS,
} from '@open-pencil/vue'
```

## Notes

- `locale` est le store de locale active résolue
- `localeSetting` est le store de préférence utilisateur persistée
- `setLocale()` met à jour la préférence et la locale active ensemble
- `AVAILABLE_LOCALES` et `LOCALE_LABELS` sont utiles pour les sélecteurs personnalisés

## API associées

- [useI18n](../composables/use-i18n)
