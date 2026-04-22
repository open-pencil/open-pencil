---
title: API języka
description: Niskopoziomowe store'y języka i metadane eksportowane przez @open-pencil/vue.
---

# API języka

Oprócz `useI18n()`, Vue SDK eksportuje niskopoziomowe prymitywy języka dla zaawansowanych integracji:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Użyj ich, gdy chcesz bezpośredniego dostępu do store'a, musisz zintegrować stan języka z większą powłoką aplikacji lub chcesz metadanych języka bez subskrybowania pełnego obiektu zwracanego przez `useI18n()`.

## Użycie

```ts
import {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  LOCALE_LABELS,
} from '@open-pencil/vue'
```

## Uwagi

- `locale` to store aktywnego języka po rozwiązaniu
- `localeSetting` to store utrwalonego ustawienia użytkownika
- `setLocale()` aktualizuje preferencję i aktywny język razem
- `AVAILABLE_LOCALES` i `LOCALE_LABELS` są przydatne dla niestandardowych selektorów

## Powiązane API

- [useI18n](../composables/use-i18n)
