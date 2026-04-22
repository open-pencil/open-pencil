---
title: Панели свойств
description: Создавайте панели свойств с компосаблами управления и headless-примитивами списков.
---

# Панели свойств

Панели свойств в `@open-pencil/vue` намеренно ориентированы на компосаблы.

Если панель в основном нуждается в значениях, производных от выделения, и действиях по обновлению — предпочитайте компосаблы.
Если панели нужна переиспользуемая структура массива/списка — используйте headless-примитив вроде `PropertyListRoot`.

## Основные компосаблы управления

Для стандартных секций свойств начните с:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Для панелей в виде списков используйте:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Пример: панель позиции

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

## Пример: панель заливок

```vue
<script setup lang="ts">
import { PropertyListRoot, useFillControls } from '@open-pencil/vue'

const fillControls = useFillControls()
</script>

<template>
  <PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="remove(index)">Удалить</button>
    </div>

    <button @click="add(fillControls.defaultFill)">Добавить заливку</button>
  </PropertyListRoot>
</template>
```

## Правило

- используйте компосаблы для прямой логики управления
- используйте структурные примитивы, когда координация повторяющихся списков/деревьев/слотов — это самая сложная часть

## Связанные API

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
