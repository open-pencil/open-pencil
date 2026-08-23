---
title: Сценарии
description: Выполнение JavaScript через совместимый с Figma Plugin API для поиска, массового изменения и создания дизайна.
---

# Сценарии

`openpencil eval` выполняет JavaScript для документа OpenPencil и предоставляет глобальный объект `figma`, совместимый с Figma Plugin API. Команда подходит для пакетных изменений, проверки документов, подготовки тестовых данных и другой автоматизации без интерфейса редактора.

## Первый вызов

```sh
openpencil eval design.fig -c "return figma.currentPage.children.length"
```

Параметр `-c` принимает JavaScript. Если код не начинается с `return`, OpenPencil помещает его в асинхронную функцию и возвращает её результат, когда он есть.

```sh
openpencil eval design.fig -c "
  const frame = figma.createFrame()
  frame.name = 'Card'
  frame.resize(300, 200)
  frame.layoutMode = 'VERTICAL'
  frame.itemSpacing = 12
  return { id: frame.id, name: frame.name }
"
```

## Поиск объектов

```sh
openpencil eval design.fig -c "
  return figma.currentPage
    .findAll((node) => node.type === 'FRAME' && node.name.includes('Button'))
    .map((button) => ({
      id: button.id,
      name: button.name,
      width: button.width,
      height: button.height
    }))
"
```

## Изменение и сохранение

`--write` или `-w` записывает изменения во входной файл. `--output` или `-o` создаёт новый файл.

## Сценарий из стандартного ввода

```sh
cat transform.js | openpencil eval design.fig --stdin --write
```

## Открытое приложение

Не указывайте файл, чтобы выполнить сценарий для текущего документа в настольном приложении:

```sh
openpencil eval -c "return figma.currentPage.name"
```

## Вывод

При перенаправлении вывода по умолчанию используется JSON. Параметр `--json` включает его явно, а `--quiet` или `-q` отключает вывод.

## Доступный API

API намеренно близок к Figma Plugin API, но работает с SceneGraph и форматами OpenPencil.

### Документ и страницы

- `figma.root`
- `figma.currentPage`
- `figma.currentPage.selection`
- `figma.getNodeById(id)`
- `figma.createPage()`

### Создание объектов

- `figma.createFrame()`
- `figma.createRectangle()`
- `figma.createEllipse()`
- `figma.createText()`
- `figma.createLine()`
- `figma.createPolygon()`
- `figma.createStar()`
- `figma.createVector()`
- `figma.createComponent()`
- `figma.createSection()`

### Дерево

- `node.children`
- `node.parent`
- `node.appendChild(child)`
- `node.insertChild(index, child)`
- `node.clone()`
- `node.remove()`
- `node.findAll(callback?)`
- `node.findOne(callback)`
- `node.findChild(callback)`
- `node.findChildren(callback?)`
- `figma.group(nodes, parent)`
- `figma.ungroup(node)`

### Компоненты

- `figma.createComponentFromNode(node)`
- `component.createInstance()`
- `instance.mainComponent`

### Переменные

- `figma.getLocalVariables(type?)`
- `figma.getVariableById(id)`
- `figma.getLocalVariableCollections()`
- `figma.getVariableCollectionById(id)`
- `figma.createVariable(name, type, collectionId, value?)`
- `figma.setVariableValue(variableId, modeId, value)`
- `figma.deleteVariable(id)`
- `figma.createVariableCollection(name)`
- `figma.deleteVariableCollection(id)`
- `figma.bindVariable(nodeId, field, variableId)`
- `figma.unbindVariable(nodeId, field)`

### Свойства

Распространённые свойства доступны для чтения и записи через прокси:

- геометрия: `x`, `y`, `width`, `height`, `rotation`, `resize(width, height)`;
- внешний вид: `fills`, `strokes`, `effects`, `opacity`, `visible`, `locked`, `blendMode`, `clipsContent`;
- радиусы: `cornerRadius`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius`;
- текст: `characters`, `fontSize`, `fontName`, `fontWeight`, выравнивание, интерлиньяж, межбуквенный интервал и функции для диапазонов стилей;
- автоматическая компоновка: `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing`, отступы, размеры и положение;
- обводка: `strokeWeight`, `strokeAlign`, `dashPattern`.

### Служебные возможности

- `figma.mixed`
- `figma.createImage(data)`
- `figma.loadFontAsync(fontName)` ничего не делает, поскольку OpenPencil не блокирует изменение текста до загрузки шрифта плагином
- `figma.listAvailableFontsAsync()` возвращает доступные системные шрифты
- `figma.notify(message)` записывает предупреждение в режиме без интерфейса
- `figma.viewport`

## Пока не совместимо с Figma

Следующие API пока не предоставляются в совместимом виде:

- `node.exportAsync()`
- `node.setBoundVariable(field, variable)`
- `node.detachInstance()`
- `figma.combineAsVariants(components, parent)`
- API стилей Figma, например `figma.createPaintStyle()` и `figma.createTextStyle()`
- полная совместимость логических операций над векторами

Вместо них используйте команды экспорта OpenPencil CLI, инструменты основного пакета или прямые вспомогательные функции SceneGraph, когда они доступны.
