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
import { useTypography } from '@open-pencil/vue/controls/typography'

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

### Оси вариативных шрифтов

`axes` перечисляет оси вариативного шрифта выделенного текста, каждую с `tag`, `name`, диапазоном и `value`, в котором она рисуется (`MIXED`, если слои различаются); для статического шрифта или слоёв разных семейств список пуст. `previewAxis` показывает значение во время перетаскивания, `setAxis` задаёт его одним шагом отмены, а `setOpticalSizeAuto` включает следование оптического размера за размером шрифта или фиксирует его. Смена толщины, наклона или семейства возвращает оси начертания.

```ts
typography.setAxis('wght', 560)
typography.setOpticalSizeAuto(false)
```

## Связанные API

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
