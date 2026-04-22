---
title: Просмотр файлов
description: Просматривайте деревья узлов, ищите по имени или типу и изучайте свойства из терминала.
---

# Просмотр файлов

CLI позволяет исследовать дизайн-документы без открытия редактора. Каждая команда также работает с запущенным приложением — просто опустите аргумент файла.

::: tip Установка
```sh
bun add -g @open-pencil/cli
# или
brew install open-pencil/tap/open-pencil
```
:::

## Информация о документе

Краткий обзор — количество страниц, общее число узлов, используемые шрифты, размер файла:

```sh
open-pencil info design.fig
```

## Дерево узлов

Вывод полной иерархии узлов:

```sh
open-pencil tree design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

## Поиск узлов

Поиск по типу:

```sh
open-pencil find design.fig --type TEXT
```

Поиск по имени:

```sh
open-pencil find design.fig --name "Button"
```

Оба флага можно комбинировать для более точных результатов.

## Запросы с XPath

Используйте XPath-селекторы для поиска узлов по типу, атрибутам и структуре дерева:

```sh
open-pencil query design.fig "//FRAME"
```

### Полезные шаблоны

**По типу:**

```sh
open-pencil query design.fig "//TEXT"                    # Все текстовые узлы
open-pencil query design.fig "//COMPONENT"               # Все компоненты
open-pencil query design.fig "//INSTANCE"                # Все экземпляры
```

**По атрибутам:**

```sh
open-pencil query design.fig "//FRAME[@width < 300]"                # Фреймы шириной менее 300px
open-pencil query design.fig "//*[@cornerRadius > 0]"               # Скруглённые углы
open-pencil query design.fig "//*[@visible = false]"                # Скрытые узлы
open-pencil query design.fig "//TEXT[@fontSize >= 24]"              # Крупный текст
open-pencil query design.fig "//*[@opacity < 1]"                    # Полупрозрачные узлы
```

**По имени и текстовому содержимому:**

```sh
open-pencil query design.fig "//TEXT[contains(@name, 'Button')]"    # Имя содержит 'Button'
open-pencil query design.fig "//TEXT[contains(@text, 'Hello')]"     # Текст содержит 'Hello'
```

**По иерархии:**

```sh
open-pencil query design.fig "//SECTION//TEXT"            # Текст внутри секций
open-pencil query design.fig "//FRAME/TEXT"               # Прямые дочерние тексты фреймов
open-pencil query design.fig "//COMPONENT_SET//INSTANCE"  # Экземпляры внутри наборов компонентов
```

### Доступные атрибуты

`name`, `width`, `height`, `x`, `y`, `visible`, `opacity`, `cornerRadius`, `fontSize`, `fontFamily`, `fontWeight`, `layoutMode`, `itemSpacing`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `strokeWeight`, `rotation`, `locked`, `blendMode`, `text`, `lineHeight`, `letterSpacing`

### Пример вывода

```
  Found 5 nodes

[0] [frame] "Logo  92×32" (0:9)
[1] [frame] "logo-short-6  31×32" (0:10)
[2] [frame] "wrapper  128×73" (0:20)
[3] [frame] "pen-drawing  148×52" (0:21)
[4] [frame] "surprised-emoji  32×32" (0:26)
```

## Свойства узла

Просмотр всех свойств конкретного узла по его ID:

```sh
open-pencil node design.fig --id 1:23
```

## Страницы

Список всех страниц в документе:

```sh
open-pencil pages design.fig
```

## Переменные

Список дизайн-переменных и их коллекций:

```sh
open-pencil variables design.fig
```

## Режим работы с приложением

Когда настольное приложение запущено, опустите аргумент файла — CLI подключится по RPC и будет работать с активным холстом:

```sh
open-pencil tree              # просмотр текущего документа
open-pencil eval -c "..."     # запрос к редактору
```

## Линтинг дизайна

Проверяйте документы на соответствие правилам именования, вёрстки, структуры и доступности:

```sh
open-pencil lint design.fig
open-pencil lint design.pen --preset strict
open-pencil lint design.fig --rule color-contrast
open-pencil lint design.fig --list-rules
```

Используйте `--json` для машиночитаемого вывода.

## JSON-вывод

Все команды поддерживают `--json` для машиночитаемого вывода — передавайте в `jq`, используйте в CI-скриптах или обрабатывайте другими инструментами:

```sh
open-pencil tree design.fig --json | jq '.[] | .name'
```
