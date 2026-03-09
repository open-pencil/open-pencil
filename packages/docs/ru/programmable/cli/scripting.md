---
title: Скрипты
description: Выполняйте JavaScript с Figma Plugin API — запрашивайте узлы, массово изменяйте дизайн, создавайте фреймы.
---

# Скрипты

`open-pencil eval` предоставляет полный Figma Plugin API в терминале. Читайте узлы, изменяйте свойства, создавайте фигуры — и сохраняйте изменения обратно в файл.

## Базовое использование

```sh
open-pencil eval design.fig -c "figma.currentPage.children.length"
```

Флаг `-c` принимает JavaScript. Глобальный объект `figma` работает как Figma Plugin API.

## Запрос узлов

```sh
open-pencil eval design.fig -c "
  figma.currentPage.findAll(n => n.type === 'FRAME' && n.name.includes('Button'))
    .map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
"
```

## Изменение и сохранение

```sh
open-pencil eval design.fig -c "
  figma.currentPage.children.forEach(n => n.opacity = 0.5)
" -w
```

`-w` записывает изменения обратно во входной файл. Используйте `-o output.fig`, чтобы записать в другой файл.

## Чтение из stdin

Для длинных скриптов:

```sh
cat transform.js | open-pencil eval design.fig --stdin -w
```

## Режим работы с приложением

Опустите файл для выполнения команд в запущенном настольном приложении:

```sh
open-pencil eval -c "figma.currentPage.name"
```

## Доступный API

Объект `figma` поддерживает:

- `figma.currentPage` — активная страница
- `figma.root` — корень документа
- `figma.createFrame()`, `figma.createRectangle()`, `figma.createEllipse()`, `figma.createText()` и др.
- `.findAll()`, `.findOne()` — поиск по потомкам
- `.appendChild()`, `.insertChild()` — манипуляции с деревом
- Все сеттеры свойств: `.fills`, `.strokes`, `.effects`, `.opacity`, `.cornerRadius`, `.layoutMode`, `.itemSpacing` и др.

Это тот же API, который используют плагины Figma, поэтому существующие знания и фрагменты кода применимы напрямую.

## JSON-вывод

```sh
open-pencil eval design.fig -c "..." --json
```
