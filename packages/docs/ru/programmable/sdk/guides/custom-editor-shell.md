---
title: Собственный интерфейс редактора
description: Создание собственного интерфейса редактора с provideEditor, CanvasRoot, меню, панелями и панелями инструментов.
---

# Собственный интерфейс редактора

Типичное приложение OpenPencil на Vue состоит из трёх уровней:

1. `@open-pencil/core` создаёт редактор;
2. `@open-pencil/vue` связывает его с composables и компонентами Vue без встроенного оформления;
3. приложение определяет компоновку, оформление и характерное для продукта поведение.

## Зачем разделять эти уровни

Готовое приложение OpenPencil — лишь один из возможных интерфейсов.

На основе SDK можно создать встроенный редактор для другого продукта, внутренний инструмент для работы с ресурсами, редактор шаблонов, интерфейс аннотирования или специализированный редактор с поддержкой ИИ.

## Рекомендуемая структура

Удобно строить интерфейс следующим образом:

- вызвать `provideEditor()` в верхней части дерева компонентов;
- разместить холст в центре;
- вывести страницы и слои на одной боковой панели;
- вывести свойства на другой боковой панели;
- управлять меню и панелями инструментов с помощью composables.

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

## Обязанности SDK и приложения

- SDK отвечает за интеграцию с редактором и переиспользуемую логику без привязки к оформлению;
- приложение отвечает за компоновку, оформление и действия, характерные для конкретного продукта;
- composables позволяют подключать меню и панели без лишних компонентов-обёрток.

## См. также

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
