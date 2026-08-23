---
title: useTypography
description: Чтение и изменение семейства, начертания, размера и выравнивания шрифта, а также форматирования текста.
---

# useTypography

`useTypography()` предоставляет панелям работы с текстом:

- семейство шрифта;
- начертание;
- размер;
- активное форматирование;
- сведения об отсутствующих шрифтах;
- функции изменения семейства, начертания, выравнивания и оформления.

## Использование

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Пример

```ts
const {
  fontFamily,
  fontWeight,
  fontSize,
  activeFormatting,
  setFamily,
  setWeight,
  setAlign,
} = useTypography()
```

### Загрузить и выбрать семейство шрифта

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Изменить форматирование

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## Связанные API

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
