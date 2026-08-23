---
title: Panele właściwości
description: Tworzenie paneli właściwości za pomocą composables i komponentów bez narzuconego wyglądu.
---

# Panele właściwości

Panele właściwości w `@open-pencil/vue` są budowane przede wszystkim za pomocą composables.

Jeśli panel potrzebuje wartości obliczonych z zaznaczenia i działań do ich zmiany, użyj composable. Jeśli ważna jest wielokrotnego użytku struktura tablicy lub listy, wybierz komponent bez narzuconego wyglądu, na przykład `PropertyListRoot`.

## Główne composables

Do zwykłych sekcji panelu właściwości służą:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Do właściwości przedstawianych jako listy:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Pola powiązane ze zmiennymi

Jeśli wartość pola można powiązać ze zmienną albo zewnętrznym tokenem projektu, umieść pole wewnątrz `BindableValueRoot`.

- Gdy pole nie jest edytowane, pokazuj nazwę zmiennej. Obliczoną wartość można wyświetlić na przykład w dymku.
- Uzyskanie fokusu i otwarcie wyboru zmiennej nie powinny usuwać powiązania.
- Stosuj `detach-on-edit`, `readonly-when-bound` albo `edit-variable` dopiero po rzeczywistej zmianie wartości.
- Osobne działanie usunięcia powiązania lepiej umieścić w oknie wyboru niż w łatwej do przypadkowego użycia ikonie obok pola.
- Zmianę powiązania, jego usunięcie podczas edycji i zmianę wielu obiektów wykonuj w jednej operacji zbiorczej dostawcy.

Aplikacja OpenPencil pokazuje nazwę zmiennej na fioletowym tle, gdy pole nie jest edytowane. Po rozpoczęciu edycji `NumberField` pokazuje obliczoną wartość liczbową. Własny interfejs może przedstawić ten sam stan inaczej.

## Przykład: położenie i rozmiar

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

## Przykład: lista zalew

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
      <button @click="actions.remove(index)">Usuń</button>
    </div>

    <button @click="actions.add(fillControls.defaultFill)">Dodaj zalew</button>
  </PropertyListRoot>
</template>
```

## Wybór API

- Używaj composables do stanu i działań.
- Używaj komponentów strukturalnych bez narzuconego wyglądu, gdy główną trudnością jest koordynacja powtarzających się list, drzew albo slotów.

## Zobacz też

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
