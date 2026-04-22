---
title: API Locale
description: Store di locale di livello inferiore e metadati esportati da @open-pencil/vue.
---

# API Locale

Oltre a `useI18n()`, il Vue SDK esporta primitive di locale di livello inferiore per integrazioni avanzate:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Usale quando vuoi accesso diretto allo store, devi integrare lo stato della lingua con una shell app più grande, o vuoi i metadati della lingua senza sottoscrivere all'intero oggetto restituito da `useI18n()`.

## Utilizzo

```ts
import {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  LOCALE_LABELS,
} from '@open-pencil/vue'
```

## Note

- `locale` è lo store della lingua attiva risolta
- `localeSetting` è lo store delle preferenze utente persistite
- `setLocale()` aggiorna sia la preferenza che la lingua attiva insieme
- `AVAILABLE_LOCALES` e `LOCALE_LABELS` sono utili per i selettori personalizzati

## API correlate

- [useI18n](../composables/use-i18n)
