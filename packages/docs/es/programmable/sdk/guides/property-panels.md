---
title: Paneles de Propiedades
description: Construye paneles de propiedades con composables de control y primitivos de lista headless.
---

# Paneles de Propiedades

Los paneles de propiedades en `@open-pencil/vue` están diseñados de forma intencionalmente composable primero.

Si un panel principalmente necesita valores derivados de la selección y acciones de actualización, prefiere composables.
Si un panel necesita estructura reutilizable de array/lista, usa un primitivo headless como `PropertyListRoot`.

## Composables de control habituales

Para secciones de propiedades estándar, empieza con:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Para paneles de tipo lista, usa:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Ejemplo: panel de posición

```vue
<script setup lang="ts">
import { usePosition } from '@open-pencil/vue'

const { x, y, width, height, updateProp, commitProp } = usePosition()
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <input :value="x" @input="updateProp('x', Number(($event.target as HTMLInputElement).value))" />
    <input :value="y" @input="updateProp('y', Number(($event.target as HTMLInputElement).value))" />
    <input :value="width" @input="updateProp('width', Number(($event.target as HTMLInputElement).value))" />
    <input :value="height" @input="updateProp('height', Number(($event.target as HTMLInputElement).value))" />
  </div>
</template>
```

## Ejemplo: panel de rellenos

```vue
<script setup lang="ts">
import { PropertyListRoot, useFillControls } from '@open-pencil/vue'

const fillControls = useFillControls()
</script>

<template>
  <PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="remove(index)">Eliminar</button>
    </div>

    <button @click="add(fillControls.defaultFill)">Añadir relleno</button>
  </PropertyListRoot>
</template>
```

## Regla práctica

- usa composables para la lógica de control directa
- usa primitivos estructurales cuando la coordinación repetida de lista/árbol/slot es la parte compleja

## APIs relacionadas

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
