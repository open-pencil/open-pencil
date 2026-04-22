---
title: Locale APIs
description: Низкоуровневые хранилища локалей и метаданные, экспортируемые @open-pencil/vue.
---

# Locale APIs

В дополнение к `useI18n()`, Vue SDK экспортирует низкоуровневые примитивы локали для продвинутых интеграций:

- `locale`
- `localeSetting`
- `setLocale()`
- `AVAILABLE_LOCALES`
- `LOCALE_LABELS`

Используйте их, когда нужен прямой доступ к хранилищу, интеграция состояния локали с более крупной оболочкой приложения или метаданные локали без подписки на полный объект возврата `useI18n()`.

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

## Примечания

- `locale` — хранилище разрешённой активной локали
- `localeSetting` — хранилище сохранённых настроек пользователя
- `setLocale()` — обновляет настройки и активную локаль одновременно
- `AVAILABLE_LOCALES` и `LOCALE_LABELS` полезны для кастомных пикеров

## Связанные API

- [useI18n](../composables/use-i18n)
