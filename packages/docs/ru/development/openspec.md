# Рабочий процесс OpenSpec

OpenPencil использует [OpenSpec](https://github.com/Fission-AI/OpenSpec) для разработки на основе спецификаций. Спецификации — это источник истины о том, что делает система.

## Структура

```
openspec/
├── specs/              # Источник истины: как система работает сейчас
│   ├── scene-graph/
│   │   └── spec.md
│   ├── canvas-rendering/
│   │   └── spec.md
│   ├── auto-layout/
│   │   └── spec.md
│   └── ...             # Всего 19 спецификаций возможностей
├── changes/            # Предлагаемые изменения (один каталог на изменение)
│   └── archive/        # Завершённые изменения
└── config.yaml         # Опциональная конфигурация
```

## Текущие спецификации

| Возможность | Описание |
|-------------|----------|
| scene-graph | Хранение в плоском Map, CRUD, проверка попадания |
| canvas-rendering | Конвейер отрисовки CanvasKit WASM |
| canvas-navigation | Панорамирование, масштабирование, инструмент «Рука» |
| selection-manipulation | Выделение кликом/рамкой, перемещение, масштабирование, поворот |
| undo-redo | Паттерн обратных команд |
| text-editing | Инструмент «Текст», Paragraph API, загрузка шрифтов |
| pen-tool | Модель векторных сетей, кривые Безье |
| auto-layout | Yoga WASM flexbox, переключение через Shift+A |
| figma-clipboard | Двусторонний бинарный Kiwi-буфер обмена |
| fig-import | Конвейер импорта .fig файлов |
| kiwi-codec | Бинарный кодек Kiwi, разреженные ID полей |
| editor-ui | Панели Vue 3, панель инструментов, палитра цветов |
| snap-guides | Привязка к краям/центрам, с учётом поворота |
| rulers | Линейки на холсте, подсветка выделения |
| group-ungroup | <kbd>⌘</kbd><kbd>G</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd>, сортировка по позиции |
| desktop-app | Tauri v2, строка меню macOS |
| testing | Playwright E2E, юнит-тесты bun:test |
| scrub-input | Ввод чисел перетаскиванием |
| tooling | Vite 7, oxlint, oxfmt, tsgo, VitePress |

## Рабочий процесс

### 1. Предложить изменение

```
/opsx:propose add-dark-mode
```

Создаёт каталог `openspec/changes/add-dark-mode/` с:
- `proposal.md` — зачем и какие изменения
- `design.md` — технический подход
- `specs/` — дельта-спецификации (ADDED/MODIFIED/REMOVED требования)
- `tasks.md` — чеклист реализации

### 2. Реализовать

```
/opsx:apply
```

Выполнение задач из tasks.md с отметкой выполненных пунктов.

### 3. Архивировать

```
/opsx:archive
```

- Объединяет дельта-спецификации с `openspec/specs/` (базовые спецификации)
- Перемещает изменение в `openspec/changes/archive/`

## Формат спецификаций

Каждый файл спецификации следует единообразной структуре:

```markdown
# capability-name Specification

## Purpose
Однострочное описание назначения этой возможности.

## Requirements

### Requirement: Name
Описание с использованием SHALL/MUST для нормативных требований.

#### Scenario: Name
- **WHEN** условие
- **THEN** ожидаемый результат
```

Каждое требование содержит хотя бы один сценарий. Сценарии — это потенциальные тест-кейсы.

## Команды CLI

```sh
openspec list                    # Список активных изменений
openspec show <name>             # Показать детали изменения
openspec status --change <name>  # Статус артефактов
openspec archive <name>          # Архивировать завершённое изменение
openspec update                  # Пересоздать навыки/промпты
```
