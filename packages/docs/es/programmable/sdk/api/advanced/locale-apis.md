---
title: APIs de Idioma
description: Stores de idioma de bajo nivel y metadatos exportados por @open-pencil/vue.
---

# APIs de Idioma

Además de `useI18n()`, el SDK de Vue exporta primitivos de idioma de más bajo nivel para integraciones avanzadas:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Úsalos cuando quieras acceso directo al store, necesites integrar el estado del idioma con un shell de app más amplio, o necesites metadatos de idioma sin suscribirte al objeto de retorno completo de `useI18n()`.

## Uso

```ts
import {
  locale,
  localeSetting,
  setLocale,
  AVAILABLE_LOCALES,
  LOCALE_LABELS,
} from '@open-pencil/vue'
```

## Notas

- `locale` es el store del idioma activo resuelto
- `localeSetting` es el store de la preferencia persistida del usuario
- `setLocale()` actualiza la preferencia y el idioma activo conjuntamente
- `AVAILABLE_LOCALES` y `LOCALE_LABELS` son útiles para selectores personalizados

## APIs relacionadas

- [useI18n](../composables/use-i18n)
