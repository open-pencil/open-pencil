---
title: Panele właściwości
description: Buduj panele właściwości z kompozytami kontrolek i bezstanowymi prymitywami list.
---

# Panele właściwości

Panele właściwości w `@open-pencil/vue` są celowo oparte na kompozytach.

Jeśli panel potrzebuje głównie wartości pochodnych od selekcji i akcji aktualizacji, preferuj kompozyty.
Jeśli panel potrzebuje wielokrotnie używalnej struktury tablicowej/listowej, użyj bezstanowego prymitywu jak `PropertyListRoot`.

## Typowe kompozyty kontrolek

Dla standardowych sekcji właściwości zacznij od:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Dla paneli listowych użyj:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Przykład: panel pozycji

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

## Przykład: panel wypełnień

```vue
<script setup lang="ts">
import { PropertyListRoot, useFillControls } from '@open-pencil/vue'

const fillControls = useFillControls()
</script>

<template>
  <PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="remove(index)">Usuń</button>
    </div>

    <button @click="add(fillControls.defaultFill)">Dodaj wypełnienie</button>
  </PropertyListRoot>
</template>
```

## Zasada

- używaj kompozytów dla bezpośredniej logiki kontrolek
- używaj prymitywów strukturalnych, gdy powtarzalna koordynacja listy/drzewa/slotu jest trudną częścią

## Powiązane API

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
