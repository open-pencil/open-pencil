---
title: useOkHCL
description: Сохранение цветового замысла OkHCL для заливок и обводок выделенных объектов.
---

# useOkHCL

`useOkHCL()` служит адаптером между редактором и метаданными OkHCL заливок и обводок. Он читает сохранённый цветовой замысел, обновляет объекты с поддержкой отмены, сообщает сведения о выходе за цветовой охват и запоминает выбранный формат каждого поля.

Для преобразования цветов, изменения каналов и отображения ползунков без зависимости от редактора используйте [`useColorModel()`](/programmable/sdk/api/composables/use-color-model). `useOkHCL()` нужен только там, где результат должен сохраняться в OpenPencil.

## Использование

```ts
const okhcl = useOkHCL()
const color = okhcl.getFillOkHCLColor(node, 0)
okhcl.updateFillOkHCL(node, 0, { c: 0.2 })
```

## Формат поля

```ts
const format = okhcl.getFieldFormat(node, 0, 'fill')
okhcl.setFillFieldFormat(node, 0, 'okhcl')
```

При выборе `okhcl` замысел инициализируется из текущего цвета RGBA заливки или обводки. `fieldOptions` можно использовать для выбора формата.

## Предварительный просмотр

```ts
const preview = okhcl.getFillPreviewInfo(node, 0)
// { previewColorSpace, clipped }
```

Предварительный просмотр учитывает цветовое пространство документа и сообщает, потребовалось ли привести сохранённый цвет OkHCL к доступному охвату.

## Возвращаемое API

- `getFillOkHCLColor()` / `getStrokeOkHCLColor()`
- `getFillPreviewInfo()` / `getStrokePreviewInfo()`
- `getFieldFormat()`
- `setFillFieldFormat()` / `setStrokeFieldFormat()`
- `updateFillOkHCL()` / `updateStrokeOkHCL()`
- `fieldOptions`

## См. также

- [useColorModel](/programmable/sdk/api/composables/use-color-model)
- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
