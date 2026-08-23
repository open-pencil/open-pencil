---
title: Просмотр документов
description: Дерево объектов, поиск по имени и типу и просмотр свойств из терминала.
---

# Просмотр документов

CLI позволяет изучать документы дизайна без запуска редактора. Те же команды работают с открытым настольным приложением, если не указывать файл.

::: tip Установка
```sh
npm install -g @open-pencil/cli
# или
bun add -g @open-pencil/cli
# или
brew install open-pencil/tap/open-pencil
```
:::

## Общие сведения

Количество страниц и объектов, используемые шрифты и размер файла:

```sh
openpencil info design.fig
```

## Дерево объектов

```sh
openpencil tree design.fig
```

## Поиск объектов

По типу:

```sh
openpencil find design.fig --type TEXT
```

По имени:

```sh
openpencil find design.fig --name "Button"
```

Параметры можно использовать одновременно.

## Запросы XPath

Селекторы XPath находят объекты по типу, атрибутам и положению в дереве:

```sh
openpencil query design.fig "//FRAME"
```

### По типу

```sh
openpencil query design.fig "//TEXT"                    # Все текстовые объекты
openpencil query design.fig "//COMPONENT"               # Все компоненты
openpencil query design.fig "//INSTANCE"                # Все экземпляры
```

### По атрибутам

```sh
openpencil query design.fig "//FRAME[@width < 300]"     # Фреймы уже 300 пикселей
openpencil query design.fig "//*[@cornerRadius > 0]"    # Объекты со скруглёнными углами
openpencil query design.fig "//*[@visible = false]"     # Скрытые объекты
openpencil query design.fig "//TEXT[@fontSize >= 24]"   # Крупный текст
openpencil query design.fig "//*[@opacity < 1]"         # Объекты с неполной прозрачностью
```

### По имени и содержимому

```sh
openpencil query design.fig "//TEXT[contains(@name, 'Button')]"
openpencil query design.fig "//TEXT[contains(@text, 'Hello')]"
```

### По иерархии

```sh
openpencil query design.fig "//SECTION//TEXT"            # Текст внутри секций
openpencil query design.fig "//FRAME/TEXT"               # Непосредственные текстовые потомки фреймов
openpencil query design.fig "//COMPONENT_SET//INSTANCE"  # Экземпляры внутри наборов компонентов
```

### Доступные атрибуты

`name`, `width`, `height`, `x`, `y`, `visible`, `opacity`, `cornerRadius`, `fontSize`, `fontFamily`, `fontWeight`, `layoutMode`, `itemSpacing`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `strokeWeight`, `rotation`, `locked`, `blendMode`, `text`, `lineHeight`, `letterSpacing`

## Свойства объекта

```sh
openpencil node design.fig --id 1:23
```

## Страницы и переменные

```sh
openpencil pages design.fig
openpencil variables design.fig
```

## Работа с открытым приложением

Если настольное приложение запущено, не указывайте путь к файлу. CLI подключится по RPC к открытому документу:

```sh
openpencil documents
openpencil tree
openpencil tree --document-id tab-123 --page-id 0:1
openpencil eval --document-id tab-123 --page-id 0:1 -c "..."
```

Для автоматизированных процессов сначала вызовите `openpencil documents --json`, а затем явно передавайте `--document-id` и `--page-id`, не полагаясь на видимую активную вкладку или страницу.

## Проверка качества

Проверка имён, компоновки, структуры и доступности:

```sh
openpencil lint design.fig
openpencil lint design.pen --preset strict
openpencil lint design.fig --rule color-contrast
openpencil lint design.fig --list-rules
```

Добавьте `--json`, если результат будет обрабатывать другая программа.

## Вывод JSON

Все команды поддерживают `--json`. Результат можно передать `jq`, проверке CI или другой программе:

```sh
openpencil tree design.fig --json | jq '.[] | .name'
```
