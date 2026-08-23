---
title: Eigenschaften-Panels
description: Eigenschaften-Panels mit Composables und Komponenten ohne vorgegebenes Erscheinungsbild entwickeln.
---

# Eigenschaften-Panels

`@open-pencil/vue` stellt für Eigenschaften-Panels vor allem Composables bereit.

Benötigt ein Panel aus der Auswahl berechnete Werte und Aktionen zur Aktualisierung, ist ein Composable die passende Grundlage. Für wiederverwendbare Listen- oder Tabellenstrukturen eignet sich eine Komponente ohne vorgegebenes Erscheinungsbild wie `PropertyListRoot`.

## Composables

Für gewöhnliche Eigenschaftsbereiche:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Für Eigenschaften in Listenform:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Variablenbindungen

Kann ein Feld an eine Variable oder ein externes Designtoken gebunden werden, sollte es in `BindableValueRoot` liegen.

- Im nicht bearbeiteten Zustand den Namen der Variable anzeigen; der berechnete Wert kann beispielsweise in einem Hinweis erscheinen.
- Der Fokus oder das Öffnen der Variablenauswahl darf eine bestehende Bindung nicht entfernen.
- `detach-on-edit`, `readonly-when-bound` oder `edit-variable` erst bei einer tatsächlichen Änderung anwenden.
- Eine ausdrückliche Aktion zum Entfernen der Bindung gehört besser in die Auswahl als in einen leicht versehentlich auslösbaren Button neben dem Feld.
- Bindungswechsel, Lösen während der Bearbeitung und Änderungen an mehreren Objekten in einer gemeinsamen Anbieter-Operation zusammenfassen.

Die OpenPencil-App zeigt den Variablennamen im Ruhezustand violett an. Sobald die Bearbeitung beginnt, zeigt `NumberField` den berechneten numerischen Wert. Eine eigene Oberfläche kann denselben Zustand anders darstellen.

## Beispiel: Position und Größe

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

## Beispiel: Füllungen

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
      <button @click="actions.remove(index)">Entfernen</button>
    </div>

    <button @click="actions.add(fillControls.defaultFill)">Füllung hinzufügen</button>
  </PropertyListRoot>
</template>
```

## Wahl der API

- Composables für Zustand und Aktionen verwenden.
- Strukturkomponenten ohne vorgegebenes Erscheinungsbild einsetzen, wenn die Koordination wiederkehrender Listen, Bäume oder Slots im Mittelpunkt steht.

## Siehe auch

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
