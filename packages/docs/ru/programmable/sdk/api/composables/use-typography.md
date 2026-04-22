---
title: useTypography
description: Чтение и обновление семейства шрифта, начертания, размера, выравнивания и форматирования для текстовых узлов.
---

# useTypography

`useTypography()` — компосабл управления текстовыми свойствами для панелей редактирования текста.

Предоставляет:

- семейство шрифта
- начертание шрифта
- размер шрифта
- состояние форматирования
- статус отсутствующего шрифта
- хелперы для изменения семейства, начертания, выравнивания и оформления

## Использование

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Базовый пример

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

## Практические примеры

### Загрузить и переключить семейство шрифта

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Переключить форматирование

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## Связанные API

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
