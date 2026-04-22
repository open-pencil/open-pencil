---
title: Shell de Editor Personalizado
description: Construye tu propio shell de editor con provideEditor, CanvasRoot, menús, paneles y barras de herramientas.
---

# Shell de Editor Personalizado

Una app Vue típica de OpenPencil tiene tres capas:

1. `@open-pencil/core` crea el editor
2. `@open-pencil/vue` lo adapta en composables de Vue y primitivos headless
3. tu app renderiza el shell, los estilos y la UX del producto

## Por qué esto importa

La app integrada de OpenPencil es solo un shell posible.

Puedes construir uno muy diferente para un flujo de trabajo enfocado: un editor integrado dentro de otro producto, una herramienta interna de recursos, un editor de plantillas, una interfaz de anotaciones, o una superficie de edición asistida por IA con controles personalizados.

Esa es la razón principal por la que existe el SDK.

## Composición recomendada

Un shell práctico a menudo tiene esta estructura:

- proveedor en lo alto con `provideEditor()`
- canvas en el centro
- navegación de páginas/capas en un lateral
- propiedades en el otro lateral
- menús y barras de herramientas impulsados por composables

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
      Panel de propiedades aquí
    </aside>
  </div>
</template>
```

## Por qué esta división funciona

- el SDK se encarga de la integración del editor y la lógica headless reutilizable
- tu app se encarga del layout, los estilos y las acciones específicas del producto
- los composables pueden impulsar menús y paneles sin componentes wrapper adicionales

## APIs relacionadas

- [provideEditor](../api/composables/provide-editor)
- [useCanvas](../api/composables/use-canvas)
- [ToolbarRoot](../api/components/toolbar-root)
- [PageListRoot](../api/components/page-list-root)
- [LayerTreeRoot](../api/components/layer-tree-root)
