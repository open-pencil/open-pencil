---
title: useSelectionState
description: Estado reactivo del editor derivado de la selección para el nodo actual, el recuento y el tipo de selección.
---

# useSelectionState

`useSelectionState()` expone el estado reactivo derivado de la selección del editor actual.

Úsalo cuando necesites renderizar UI basándote en:

- si hay algo seleccionado
- cuántos nodos están seleccionados
- el nodo seleccionado principal
- si la selección actual es una instancia, componente o grupo

## Uso

```ts
import { useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
```

## Ejemplo básico

```vue
<script setup lang="ts">
import { useSelectionState } from '@open-pencil/vue'

const { hasSelection, selectedCount, isInstance } = useSelectionState()
</script>

<template>
  <div class="text-xs text-muted">
    <span v-if="!hasSelection">Sin selección</span>
    <span v-else>
      {{ selectedCount }} seleccionados
      <span v-if="isInstance">· instancia</span>
    </span>
  </div>
</template>
```

## Qué devuelve

Los valores más útiles incluyen:

- `selectedIds`
- `hasSelection`
- `selectedNode`
- `selectedCount`
- `selectedNodeType`
- `isInstance`
- `isComponent`
- `isGroup`
- `canCreateComponentSet`

## Ejemplos prácticos

### Mostrar acciones solo para instancias

```ts
const { isInstance } = useSelectionState()
```

### Habilitar la UI de creación de conjuntos de componentes

```ts
const { canCreateComponentSet } = useSelectionState()
```

## APIs relacionadas

- [useSelectionCapabilities](./use-selection-capabilities)
- [useEditorCommands](./use-editor-commands)
- [useEditor](./use-editor)
