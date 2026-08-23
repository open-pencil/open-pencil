---
title: Экспорт
description: Экспорт содержимого документа в PNG, JPG, WEBP, SVG, .fig, JSX или HTML и преобразование между форматами.
---

# Экспорт

CLI экспортирует дизайн в растровые изображения, векторную графику, отдельные документы `.fig`, JSX или HTML.

## Изображения и .fig

```sh
openpencil export design.fig                           # PNG по умолчанию
openpencil export design.fig -f jpg -s 2 -q 90        # JPG, масштаб 2×, качество 90
openpencil export design.fig -f webp -s 3             # WEBP, масштаб 3×
openpencil export design.fig -f svg                   # SVG
openpencil export design.fig -f fig --page "Page 1"   # одна страница в отдельном .fig
openpencil export design.fig -f fig --node 1:23        # один объект в отдельном .fig
openpencil export design.fig -f html --css tailwind    # фрагмент HTML с классами Tailwind
```

Параметры:

- `-f` — формат: `png`, `jpg`, `webp`, `svg`, `jsx`, `html` или `fig`;
- `-s` — масштаб от `1` до `4`;
- `-q` — качество от `0` до `100`, только для JPG и WEBP;
- `-o` — путь к выходному файлу;
- `--page` — имя страницы;
- `--node` — идентификатор объекта.

## JSX

Чтобы получить JSX с классами Tailwind:

```sh
openpencil export design.fig -f jsx --style tailwind
```

Параметр `--style openpencil` выбирает собственный формат JSX OpenPencil. Подробнее — в разделе [Рендерер JSX](../jsx-renderer).

## HTML

По умолчанию команда создаёт фрагмент HTML со встроенными стилями. Вместо них можно использовать классы Tailwind:

```sh
openpencil export design.fig -f html
openpencil export design.fig -f html --css tailwind
```

Параметр `--html standalone` создаёт полноценный HTML-документ, который можно открыть в браузере. В него входят стили сброса и обёртка страницы. Этот формат предназначен для передачи дизайна и кода, а не для точного воспроизведения отрисовки до пикселя:

```sh
openpencil export design.fig -f html --html standalone --css inline
openpencil export design.fig -f html --html standalone --css tailwind
openpencil export design.fig -f html --html standalone --css tailwind --assets external
```

При автономном экспорте Tailwind CSS компилируется сразу, поэтому браузерная среда Tailwind не требуется. `--assets external` сохраняет CSS и извлечённые изображения рядом с HTML. В сочетании с ним `--fonts assets` находит шрифты текстовых объектов SceneGraph через настроенных поставщиков веб-шрифтов и создаёт локальные файлы `@font-face`.

Экспорт HTML доступен при работе с файлом.

## Миниатюра

```sh
openpencil export design.fig --thumbnail --width 1920 --height 1080
```

## Экспорт из запущенного приложения

Не указывайте файл, чтобы экспортировать текущий документ из приложения:

```sh
openpencil export -f png    # снимок текущего холста
```
