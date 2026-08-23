---
title: Interfaz de edición propia
description: Crear una interfaz con provideEditor, CanvasRoot, Menús, Paneles y Toolbars.
---

# Interfaz de edición propia

Una aplicación de OpenPencil basada en Vue suele tener tres capas:

1. `@open-pencil/core` crea el Editor;
2. `@open-pencil/vue` lo conecta con composables y componentes sin estilos de Vue;
3. la aplicación define disposición, estilos y comportamiento específico del producto.

## Casos de uso

La aplicación de OpenPencil es solo una interfaz posible. El SDK permite crear un editor integrado en otro producto, una herramienta interna para recursos, un editor de plantillas, una interfaz de anotación o un editor especializado con asistencia de AI.

## Estructura recomendada

Una interfaz habitual:

- ejecuta `provideEditor()` en un nivel alto del árbol de componentes;
- coloca el canvas en el centro;
- muestra Pages y Layers en un panel lateral;
- muestra las propiedades en el panel opuesto;
- controla Menús y Toolbars mediante composables.

## Ejemplo

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
      Panel de propiedades
    </aside>
  </div>
</template>
```

## Responsabilidades

- El SDK se ocupa de la integración con el editor y de la lógica reutilizable sin estilos.
- La aplicación controla la disposición, los estilos y sus propias acciones.
- Los composables proporcionan los datos de menús y paneles sin obligar a crear componentes envolventes adicionales.

## Consulta también

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
