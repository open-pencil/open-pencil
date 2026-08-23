---
title: Locale API
description: Low-level Locale stores und Metadata aus @open-pencil/vue.
---

# Locale API

Zusätzlich zu `useI18n()` exportiert das Vue SDK ein low-level API für direkten Zugriff auf Locale state:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Diese Exports eignen sich, wenn Locale Teil eines umfassenderen Application state ist oder die Liste der verfügbaren Sprachen ohne das vollständige `useI18n()` API benötigt wird.

## Verwendung

```ts
import {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  LOCALE_LABELS,
} from '@open-pencil/vue'
```

## Verhalten

- `locale` enthält das nach Settings und Fallback tatsächlich verwendete Locale.
- `localeSetting` speichert die Preference des Benutzer.
- `setLocale()` aktualisiert Preference und aktives Locale.
- `AVAILABLE_LOCALES` und `LOCALE_LABELS` dienen zum Aufbau eines eigenen Locale picker.

## Siehe auch

- [useI18n](../composables/use-i18n)
