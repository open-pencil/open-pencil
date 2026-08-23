---
title: Paneles de propiedades
description: Crear paneles de propiedades con composables y componentes sin aspecto predefinido.
---

# Paneles de propiedades

`@open-pencil/vue` ofrece principalmente composables para construir paneles de propiedades.

Si un panel necesita valores calculados a partir de la selección y acciones para modificarlos, usa un composable. Si requiere una estructura reutilizable para matrices o listas, usa un componente sin aspecto predefinido como `PropertyListRoot`.

## Composables

Para secciones habituales:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Para propiedades en forma de lista:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Enlaces con variables

Cuando un campo pueda vincularse a una variable o un token de diseño externo, colócalo dentro de `BindableValueRoot`.

- Sin edición activa, muestra el nombre de la variable; el valor calculado puede aparecer en una ayuda emergente.
- El foco y la apertura del selector de variables no deben eliminar un enlace existente.
- Aplica `detach-on-edit`, `readonly-when-bound` o `edit-variable` solo después de una modificación real.
- Es preferible incluir una acción explícita para eliminar el enlace dentro del selector que un botón fácil de pulsar por accidente junto al campo.
- Agrupa cambios de enlace, separación durante la edición y actualizaciones de varios objetos en una sola operación por lotes del proveedor.

La aplicación de OpenPencil muestra el nombre de la variable en morado cuando el campo está inactivo. Al empezar a editar, `NumberField` muestra el valor numérico calculado. Una interfaz propia puede presentar el mismo estado de otra forma.

## Ejemplo: posición y tamaño

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

## Ejemplo: rellenos

```vue
<script setup lang="ts">
import {
  PropertyListRoot,
  useEditorPropertyList,
  useFillControls
} from '@open-pencil/vue'

const fillControls = useFillControls()
const fills = useEditorPropertyList('fills')
</script>

<template>
  <PropertyListRoot
    prop-key="fills"
    :items="fills.items.value"
    :mixed="fills.isMixed.value"
    @add="fills.actions.add"
    @remove="fills.actions.remove"
    v-slot="{ items, actions }"
  >
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="actions.remove(index)">Eliminar</button>
    </div>

    <button @click="actions.add(fillControls.defaultFill)">Añadir relleno</button>
  </PropertyListRoot>
</template>
```

## Elegir la API

- Composables para el estado y las acciones.
- Componentes estructurales sin aspecto predefinido cuando lo principal sea coordinar listas, árboles o slots repetidos.

## Consulta también

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
