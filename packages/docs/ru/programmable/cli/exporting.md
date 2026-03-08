---
title: Экспорт
description: Рендер .fig-файлов в PNG, JPG, WEBP, SVG или JSX с классами Tailwind.
---

# Экспорт

Экспортируйте дизайн из терминала — растровые изображения, вектор или JSX-код.

## Экспорт изображений

```sh
open-pencil export design.fig                          # PNG (по умолчанию)
open-pencil export design.fig -f jpg -s 2 -q 90       # JPG в 2×, качество 90
open-pencil export design.fig -f webp -s 3             # WEBP в 3×
open-pencil export design.fig -f svg                   # SVG-вектор
```

Параметры:

- `-f` — формат: `png`, `jpg`, `webp`, `svg`, `jsx`
- `-s` — масштаб: `1`–`4`
- `-q` — качество: `0`–`100` (только JPG/WEBP)
- `-o` — путь для сохранения
- `--page` — имя страницы
- `--node` — ID конкретного узла

## Экспорт в JSX

Экспорт в JSX с утилитарными классами Tailwind:

```sh
open-pencil export design.fig -f jsx --style tailwind
```

Результат:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Также поддерживается `--style openpencil` для нативного JSX-формата (см. [JSX-рендерер](../jsx-renderer)).

## Миниатюры

```sh
open-pencil export design.fig --thumbnail --width 1920 --height 1080
```

## Режим работы с приложением

Опустите файл для экспорта из запущенного приложения:

```sh
open-pencil export -f png    # снимок текущего холста
```
