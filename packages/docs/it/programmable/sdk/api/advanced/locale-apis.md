---
title: API della lingua
description: Store e metadati di basso livello per la lingua in @open-pencil/vue.
---

# API della lingua

Oltre a `useI18n()`, il Vue SDK esporta un’API di basso livello per accedere direttamente allo stato della lingua:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Questi export sono utili quando la lingua fa parte di uno stato applicativo più ampio o serve l’elenco delle lingue senza l’intera API di `useI18n()`.

```ts
import {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  LOCALE_LABELS,
} from '@open-pencil/vue'
```

- `locale` contiene la lingua effettivamente usata dopo impostazioni e ripiego.
- `localeSetting` conserva la preferenza dell’utente.
- `setLocale()` aggiorna preferenza e lingua attiva.

## Vedi anche

- [useI18n](../composables/use-i18n)
