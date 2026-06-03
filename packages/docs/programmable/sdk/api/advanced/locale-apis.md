---
title: Locale APIs
description: Lower-level locale stores and metadata exported by @inkly/vue.
---

# Locale APIs

In addition to `useI18n()`, the Vue SDK exports lower-level locale primitives for advanced integrations:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Use these when you want direct store access, need to integrate locale state with a larger app shell, or want locale metadata without subscribing to the full `useI18n()` return object.

## Usage

```ts
import {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  LOCALE_LABELS,
} from '@inkly/vue'
```

## Notes

- `locale` is the resolved active locale store
- `localeSetting` is the persisted user preference store
- `setLocale()` updates the preference and active locale together
- `AVAILABLE_LOCALES` and `LOCALE_LABELS` are useful for custom pickers

## Related APIs

- [useI18n](../composables/use-i18n)
