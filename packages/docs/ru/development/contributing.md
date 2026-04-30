# Участие в разработке

## Структура проекта

```
packages/
  core/              @open-pencil/core — движок (без DOM-зависимостей)
    src/             Граф сцены, отрисовщик, компоновка, кодек, kiwi, типы
  cli/               @open-pencil/cli — headless CLI для операций с .fig
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — MCP-сервер для AI-инструментов
    src/             stdio + HTTP (Hono) транспорты, 87 инструментов
src/
  components/        Vue SFC (холст, панели, панель инструментов, палитра цветов)
    properties/      Секции панели свойств (Внешний вид, Заливка, Обводка и др.)
  composables/       Ввод на холсте, сочетания клавиш, хуки отрисовки
  stores/            Состояние редактора (реактивность Vue)
  engine/            Шимы реэкспорта из @open-pencil/core
  kiwi/              Шимы реэкспорта из @open-pencil/core
  types.ts           Общие типы (реэкспорт из core)
  constants.ts       Цвета UI, значения по умолчанию, пороги
desktop/             Tauri v2 (Rust + конфигурация)
tests/
  e2e/               Визуальная регрессия Playwright
  engine/            Юнит-тесты (bun:test)
docs/                Сайт документации VitePress
  specs/             Спецификации возможностей (источник истины)
  changes/           Активные и архивные изменения
```

## Настройка среды разработки

```sh
bun install
bun run dev          # Редактор на localhost:1420
bun run docs:dev     # Документация на localhost:5173
```

## Стиль кода

### Инструменты

| Инструмент | Команда | Назначение |
|------------|---------|------------|
| oxlint | `bun run lint` | Линтинг (на Rust, быстрый) |
| oxfmt | `bun run format` | Форматирование кода |
| tsgo | `bun run typecheck` | Проверка типов (TypeScript-чекер на Go) |

Запуск всех проверок:

```sh
bun run check
```

### Соглашения

- **Имена файлов** — kebab-case (`scene-graph.ts`, `use-canvas-input.ts`)
- **Компоненты** — PascalCase Vue SFC (`EditorCanvas.vue`, `ScrubInput.vue`)
- **Константы** — SCREAMING_SNAKE_CASE
- **Функции/переменные** — camelCase
- **Типы/интерфейсы** — PascalCase

### Соглашения для AI-агентов

Разработчики и AI-агенты, работающие с кодовой базой, должны прочитать `AGENTS.md` в корне репозитория ([посмотреть на GitHub](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md)). Файл охватывает отрисовку, граф сцены, компоненты и экземпляры, компоновку, UI, формат файлов, соглашения Tauri и известные проблемы.

## Внесение изменений

3. Реализуйте изменение
4. Запустите `bun run check` и `bun run test`
5. Создайте pull request

## Ключевые файлы

Исходники core-движка находятся в `packages/core/src/`. Код приложения для редактора, документов, AI, коллаборации, shell, демо и автоматизации живёт в `src/app/*`; Vue SDK содержит переиспользуемый canvas/composable-код в `packages/vue/src/`.

| Файл | Назначение |
|------|------------|
| `packages/core/src/scene-graph/` | Граф сцены: узлы, переменные, экземпляры, проверка попадания |
| `packages/core/src/canvas/renderer.ts` | Конвейер отрисовки CanvasKit |
| `packages/core/src/layout.ts` | Адаптер компоновки Yoga |
| `packages/core/src/scene-graph/undo.ts` | Менеджер отмены/повтора |
| `packages/core/src/clipboard.ts` | Figma-совместимый буфер обмена |
| `packages/core/src/vector/` | Модель векторных сетей |
| `packages/core/src/io/formats/raster/render.ts` | Внеэкранный экспорт изображений (PNG/JPG/WEBP) |
| `packages/core/src/kiwi/binary/codec.ts` | Бинарный кодировщик/декодировщик Kiwi |
| `packages/core/src/kiwi/fig-import.ts` | Логика импорта .fig файлов |
| `packages/cli/src/index.ts` | Точка входа CLI |
| `packages/core/src/tools/` | Унифицированные определения инструментов по доменам (read, create, modify, structure, variables, vector, analyze) |
| `packages/core/src/figma-api/` | Реализация Figma Plugin API |
| `packages/mcp/src/server.ts` | Фабрика MCP-сервера |
| `packages/cli/src/commands/` | Команды CLI (info, tree, find, export, eval, analyze) |
| `src/app/editor/session/create.ts` | Editor session assembly |
| `packages/vue/src/canvas/CanvasRoot.vue` | Composable отрисовки холста |
| `packages/vue/src/canvas/useCanvasInput.ts` | Обработка ввода мышью/тачем |
| `src/app/shell/keyboard/use.ts` | Обработка сочетаний клавиш |
