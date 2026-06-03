---
title: Просмотр файлов
description: Просматривайте деревья узлов, ищите по имени или типу и изучайте свойства из терминала.
---

# Просмотр файлов

CLI позволяет исследовать дизайн-документы без открытия редактора. Каждая команда также работает с запущенным приложением — просто опустите аргумент файла.

::: tip Установка
```sh
npm install -g @open-pencil/cli
# или
brew install open-pencil/tap/open-pencil
```
:::

## Информация о документе

Краткий обзор — количество страниц, общее число узлов, используемые шрифты, размер файла:

```sh
openpencil info design.fig
```

## Дерево узлов

Вывод полной иерархии узлов:

```sh
openpencil tree design.fig
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
openpencil find design.fig --type TEXT
```

Поиск по имени:

```sh
openpencil find design.fig --name "Button"
```

Оба флага можно комбинировать для более точных результатов.

## Запросы с XPath

Используйте XPath-селекторы для поиска узлов по типу, атрибутам и структуре дерева:

```sh
openpencil query design.fig "//FRAME"
```

### Полезные шаблоны

**По типу:**

```sh
openpencil query design.fig "//TEXT"                    # Все текстовые узлы
openpencil query design.fig "//COMPONENT"               # Все компоненты
openpencil query design.fig "//INSTANCE"                # Все экземпляры
```

**По атрибутам:**

```sh
openpencil query design.fig "//FRAME[@width < 300]"                # Фреймы шириной менее 300px
openpencil query design.fig "//*[@cornerRadius > 0]"               # Скруглённые углы
openpencil query design.fig "//*[@visible = false]"                # Скрытые узлы
openpencil query design.fig "//TEXT[@fontSize >= 24]"              # Крупный текст
openpencil query design.fig "//*[@opacity < 1]"                    # Полупрозрачные узлы
```

**По имени и текстовому содержимому:**

```sh
openpencil query design.fig "//TEXT[contains(@name, 'Button')]"    # Имя содержит 'Button'
openpencil query design.fig "//TEXT[contains(@text, 'Hello')]"     # Текст содержит 'Hello'
```

**По иерархии:**

```sh
openpencil query design.fig "//SECTION//TEXT"            # Текст внутри секций
openpencil query design.fig "//FRAME/TEXT"               # Прямые дочерние тексты фреймов
openpencil query design.fig "//COMPONENT_SET//INSTANCE"  # Экземпляры внутри наборов компонентов
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
openpencil node design.fig --id 1:23
```

## Страницы

Список всех страниц в документе:

```sh
openpencil pages design.fig
```

## Переменные

Список дизайн-переменных и их коллекций:

```sh
openpencil variables design.fig
```

## Режим работы с приложением

Когда настольное приложение запущено, опустите аргумент файла — CLI подключится по RPC и будет работать с активным холстом:

```sh
openpencil tree              # просмотр текущего документа
openpencil eval -c "..."     # запрос к редактору
```

## Линтинг дизайна

Проверяйте документы на соответствие правилам именования, вёрстки, структуры и доступности:

```sh
openpencil lint design.fig
openpencil lint design.pen --preset strict
openpencil lint design.fig --rule color-contrast
openpencil lint design.fig --list-rules
```

Используйте `--json` для машиночитаемого вывода.

## JSON-вывод

Все команды поддерживают `--json` для машиночитаемого вывода — передавайте в `jq`, используйте в CI-скриптах или обрабатывайте другими инструментами:

```sh
openpencil tree design.fig --json | jq '.[] | .name'
```
