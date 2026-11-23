---
title: Locale APIs
description: Lower-level locale stores and metadata exported by @open-pencil/vue.
---

# Locale APIs

In addition to `useLocale()`, the Vue SDK exports lower-level locale primitives for advanced integrations:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Use these when you want direct store access or need to integrate locale state with a larger app shell, outside a component.

## Usage

```ts
import { locale, localeSetting, setLocale, AVAILABLE_LOCALES, LOCALE_LABELS } from '@open-pencil/vue/i18n'
```

## Notes

- `locale` is the resolved active locale store
- `localeSetting` is the persisted user preference store
- `setLocale()` updates the preference and active locale together
- `AVAILABLE_LOCALES` and `LOCALE_LABELS` are useful for custom pickers

## Related APIs

- [useMessages](../composables/use-messages)
