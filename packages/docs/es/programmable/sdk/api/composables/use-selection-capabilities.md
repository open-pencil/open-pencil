---
title: useSelectionCapabilities
description: Deriva booleanos amigables para comandos en UI y acciones impulsadas por la selección.
---

# useSelectionCapabilities

`useSelectionCapabilities()` expone booleanos reactivos sobre si las acciones habituales del editor están permitidas en el momento actual.

Úsalo cuando construyas:

- menús
- barras de herramientas
- atajos de teclado
- botones de acción
- paneles contextuales

## Uso

```ts
import { useSelectionCapabilities } from '@open-pencil/vue'

const caps = useSelectionCapabilities()
```

## Ejemplo básico

```vue
<script setup lang="ts">
import { useSelectionCapabilities } from '@open-pencil/vue'

const { canDelete, canDuplicate, canCreateComponent } = useSelectionCapabilities()
</script>

<template>
  <div class="flex gap-2">
    <button :disabled="!canDuplicate">Duplicar</button>
    <button :disabled="!canDelete">Eliminar</button>
    <button :disabled="!canCreateComponent">Hacer componente</button>
  </div>
</template>
```

## Ejemplos prácticos

### Controlar las entradas del menú

```ts
const { canMoveToPage, canGoToMainComponent } = useSelectionCapabilities()
```

### Habilitar los comandos de zoom solo cuando sean útiles

```ts
const { canZoomToSelection } = useSelectionCapabilities()
```

## APIs relacionadas

- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)
