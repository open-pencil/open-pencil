---
title: Pannelli Proprietà
description: Crea pannelli proprietà con composable di controllo e primitive di lista headless.
---

# Pannelli Proprietà

I pannelli proprietà in `@open-pencil/vue` sono intenzionalmente progettati per essere composable-first.

Se un pannello ha principalmente bisogno di valori derivati dalla selezione e azioni di aggiornamento, preferisci i composable.
Se un pannello ha bisogno di struttura array/lista riutilizzabile, usa una primitiva headless come `PropertyListRoot`.

## Composable di controllo comuni

Per le sezioni proprietà standard, inizia con:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Per pannelli in stile lista, usa:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Esempio: pannello posizione

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

## Esempio: pannello riempimenti

```vue
<script setup lang="ts">
import { PropertyListRoot, useFillControls } from '@open-pencil/vue'

const fillControls = useFillControls()
</script>

<template>
  <PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="remove(index)">Rimuovi</button>
    </div>

    <button @click="add(fillControls.defaultFill)">Aggiungi riempimento</button>
  </PropertyListRoot>
</template>
```

## Regola pratica

- usa i composable per logica di controllo diretta
- usa le primitive strutturali quando la parte difficile è la coordinazione ripetuta di lista/albero/slot

## API correlate

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
