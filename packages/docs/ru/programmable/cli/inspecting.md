---
title: Просмотр документов
description: Дерево объектов, поиск по имени и типу и просмотр свойств из терминала.
---

# Просмотр документов

CLI позволяет изучать документы дизайна без запуска редактора. Те же команды работают с открытым настольным приложением, если не указывать файл.

::: tip Установка

```sh
npm install -g @lawha/cli
# или
bun add -g @lawha/cli
```

:::

## Общие сведения

Количество страниц и объектов, используемые шрифты и размер файла:

```sh
lawha info design.fig
```

## Дерево объектов

```sh
lawha tree design.fig
```

## Поиск объектов

По типу:

```sh
lawha find design.fig --type TEXT
```

По имени:

```sh
lawha find design.fig --name "Button"
```

Параметры можно использовать одновременно.

## Запросы XPath

Селекторы XPath находят объекты по типу, атрибутам и положению в дереве:

```sh
lawha query design.fig "//FRAME"
```

### По типу

```sh
lawha query design.fig "//TEXT"                    # Все текстовые объекты
lawha query design.fig "//COMPONENT"               # Все компоненты
lawha query design.fig "//INSTANCE"                # Все экземпляры
```

### По атрибутам

```sh
lawha query design.fig "//FRAME[@width < 300]"     # Фреймы уже 300 пикселей
lawha query design.fig "//*[@cornerRadius > 0]"    # Объекты со скруглёнными углами
lawha query design.fig "//*[@visible = false]"     # Скрытые объекты
lawha query design.fig "//TEXT[@fontSize >= 24]"   # Крупный текст
lawha query design.fig "//*[@opacity < 1]"         # Объекты с неполной прозрачностью
```

### По имени и содержимому

```sh
lawha query design.fig "//TEXT[contains(@name, 'Button')]"
lawha query design.fig "//TEXT[contains(@text, 'Hello')]"
```

### По иерархии

```sh
lawha query design.fig "//SECTION//TEXT"            # Текст внутри секций
lawha query design.fig "//FRAME/TEXT"               # Непосредственные текстовые потомки фреймов
lawha query design.fig "//COMPONENT_SET//INSTANCE"  # Экземпляры внутри наборов компонентов
```

### Доступные атрибуты

`name`, `width`, `height`, `x`, `y`, `visible`, `opacity`, `cornerRadius`, `fontSize`, `fontFamily`, `fontWeight`, `layoutMode`, `itemSpacing`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `strokeWeight`, `rotation`, `locked`, `blendMode`, `text`, `lineHeight`, `letterSpacing`

## Свойства объекта

```sh
lawha node design.fig --id 1:23
```

## Страницы и переменные

```sh
lawha pages design.fig
lawha variables design.fig
```

## Работа с открытым приложением

Если настольное приложение запущено, не указывайте путь к файлу. CLI подключится по RPC к открытому документу:

```sh
lawha documents list
lawha tree
lawha tree --document-id tab-123 --page-id 0:1
lawha eval --document-id tab-123 --page-id 0:1 -c "..."
```

Для автоматизированных процессов сначала вызовите `lawha documents list --json`, а затем явно передавайте `--document-id` и `--page-id`, не полагаясь на видимую активную вкладку или страницу. Как открывать, сохранять, переключать и закрывать документы, отменять изменения, менять настройки и вызывать любые инструменты редактора, описано в [Controlling the App](/programmable/cli/app-control).

## Проверка качества

Проверка имён, компоновки, структуры и доступности:

```sh
lawha lint design.fig
lawha lint design.pen --preset strict
lawha lint design.fig --rule color-contrast
lawha lint design.fig --list-rules
lawha lint design.fig --fix -o fixed.fig
```

Добавьте `--json`, если результат будет обрабатывать другая программа: каждое сообщение содержит `fix` и `suggestions` в виде данных. `--fix` применяет безопасные исправления — привязывает цвета к подходящим переменным цвета и округляет геометрию до целых пикселей — и записывает результат в файл `.fig`, указанный в `-o`.

## Вывод JSON

Все команды поддерживают `--json`. Результат можно передать `jq`, проверке CI или другой программе:

```sh
lawha tree design.fig --json | jq '.[] | .name'
```
