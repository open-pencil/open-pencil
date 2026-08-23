---
title: Locale API
description: Low-level locale stores и metadata из @open-pencil/vue.
---

# Locale API

Помимо `useI18n()`, Vue SDK экспортирует API для прямой работы с locale:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Используйте их для прямого доступа к store, интеграции locale state с application shell или получения metadata без subscription на весь объект `useI18n()`.

## Использование

```ts
import {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  LOCALE_LABELS,
} from '@open-pencil/vue'
```

## Поведение

- `locale` — store фактически выбранного locale;
- `localeSetting` — сохранённая user preference;
- `setLocale()` одновременно обновляет preference и active locale;
- `AVAILABLE_LOCALES` и `LOCALE_LABELS` подходят для собственного locale picker.

## См. также

- [useI18n](../composables/use-i18n)
