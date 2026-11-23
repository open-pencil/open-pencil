---
title: Locale API
description: Low-level locale stores i metadata eksportowane przez @open-pencil/vue.
---

# Locale API

Poza `useLocale()` Vue SDK eksportuje low-level API do bezpośredniej pracy z locale:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Użyj tych exports, gdy locale jest częścią szerszego application state albo potrzebujesz listy dostępnych języków bez całego API zwracanego przez `useLocale()`.

## Użycie

```ts
import { locale, localeSetting, setLocale, AVAILABLE_LOCALES, LOCALE_LABELS } from '@open-pencil/vue/i18n'
```

## Zachowanie

- `locale` zawiera aktualnie używane locale po uwzględnieniu ustawień i fallback.
- `localeSetting` przechowuje preference użytkownika.
- `setLocale()` aktualizuje preference i aktywne locale.
- `AVAILABLE_LOCALES` i `LOCALE_LABELS` służą do budowania własnego locale picker.

## Zobacz też

- [useMessages](/developers/sdk/api/composables/use-messages)
