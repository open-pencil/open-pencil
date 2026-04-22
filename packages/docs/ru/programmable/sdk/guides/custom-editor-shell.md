---
title: Кастомная оболочка редактора
description: Создайте собственную оболочку редактора с provideEditor, CanvasRoot, меню, панелями и тулбарами.
---

# Кастомная оболочка редактора

Типичное Vue-приложение OpenPencil состоит из трёх слоёв:

1. `@open-pencil/core` создаёт редактор
2. `@open-pencil/vue` адаптирует его в Vue-компосаблы и headless-примитивы
3. ваше приложение рендерит оболочку, стили и UX продукта

## Зачем это важно

Встроенное приложение OpenPencil — лишь одна возможная оболочка.

Вы можете создать совершенно другую — для узкого рабочего процесса: встроенный редактор внутри другого продукта, внутренний инструмент для работы с ассетами, редактор шаблонов, UI для аннотаций или поверхность для редактирования с ИИ-помощником и кастомными элементами управления.

Именно для этого и существует SDK.

## Рекомендуемая компоновка

Практичная оболочка обычно выглядит так:

- провайдер наверху с `provideEditor()`
- холст по центру
- навигация по страницам/слоям сбоку
- свойства с другой стороны
- меню и тулбары управляются компосаблами

## Пример

```vue
<script setup lang="ts">
import { createEditor } from '@open-pencil/core/editor'
import {
  provideEditor,
  CanvasRoot,
  CanvasSurface,
  ToolbarRoot,
  PageListRoot,
  LayerTreeRoot,
} from '@open-pencil/vue'

const editor = createEditor({ width: 1440, height: 900 })
provideEditor(editor)
</script>

<template>
  <div class="grid h-screen grid-cols-[240px_1fr_320px] grid-rows-[48px_1fr]">
    <ToolbarRoot v-slot="{ tools, activeTool, setTool }">
      <header class="col-span-3 flex items-center gap-2 border-b px-3">
        <button
          v-for="tool in tools"
          :key="tool.id"
          :data-active="activeTool === tool.id"
          @click="setTool(tool.id)"
        >
          {{ tool.label }}
        </button>
      </header>
    </ToolbarRoot>

    <aside class="border-r">
      <PageListRoot v-slot="{ pages, currentPageId, switchPage }">
        <nav>
          <button
            v-for="page in pages"
            :key="page.id"
            :data-active="page.id === currentPageId"
            @click="switchPage(page.id)"
          >
            {{ page.name }}
          </button>
        </nav>
      </PageListRoot>
    </aside>

    <main>
      <CanvasRoot>
        <CanvasSurface class="size-full" />
      </CanvasRoot>
    </main>

    <aside class="border-l">
      Панель свойств
    </aside>
  </div>
</template>
```

## Почему такое разделение работает

- SDK отвечает за интеграцию с редактором и переиспользуемую headless-логику
- приложение отвечает за макет, стили и действия, специфичные для продукта
- компосаблы могут управлять меню и панелями без дополнительных компонентов-обёрток

## Связанные API

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
