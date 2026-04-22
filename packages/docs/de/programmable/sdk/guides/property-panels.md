---
title: Eigenschafts-Panels
description: Eigenschafts-Panels mit Steuerelemente-Composables und headless Listen-Primitiven erstellen.
---

# Eigenschafts-Panels

Eigenschafts-Panels in `@open-pencil/vue` sind bewusst composable-first gestaltet.

Wenn ein Panel hauptsächlich auswahlabgeleitete Werte und Aktualisierungsaktionen benötigt, bevorzugen Sie Composables.
Wenn ein Panel wiederverwendbare Array/Listen-Struktur benötigt, verwenden Sie ein headless Primitiv wie `PropertyListRoot`.

## Häufige Steuerelemente-Composables

Für Standard-Eigenschaftsbereiche beginnen Sie mit:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Für listenbasierte Panels verwenden Sie:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Beispiel: Positions-Panel

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

## Beispiel: Füllungen-Panel

```vue
<script setup lang="ts">
import { PropertyListRoot, useFillControls } from '@open-pencil/vue'

const fillControls = useFillControls()
</script>

<template>
  <PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="remove(index)">Entfernen</button>
    </div>

    <button @click="add(fillControls.defaultFill)">Füllung hinzufügen</button>
  </PropertyListRoot>
</template>
```

## Faustregel

- Composables für direkte Kontrolllogik verwenden
- strukturelle Primitive verwenden, wenn wiederholte Listen/Baum/Slot-Koordination der schwierige Teil ist

## Verwandte APIs

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
