---
title: Panneaux de propriétés
description: Créez des panneaux de propriétés avec des composables de contrôle et des primitives de liste headless.
---

# Panneaux de propriétés

Les panneaux de propriétés dans `@open-pencil/vue` sont intentionnellement axés sur les composables.

Si un panneau n'a besoin que de valeurs dérivées de la sélection et d'actions de mise à jour, préférez les composables.
Si un panneau nécessite une structure de tableau/liste réutilisable, utilisez une primitive headless comme `PropertyListRoot`.

## Composables de contrôle courants

Pour les sections de propriétés standard, commencez par :

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Pour les panneaux en forme de liste, utilisez :

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Exemple : panneau de position

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

## Exemple : panneau de remplissages

```vue
<script setup lang="ts">
import { PropertyListRoot, useFillControls } from '@open-pencil/vue'

const fillControls = useFillControls()
</script>

<template>
  <PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="remove(index)">Supprimer</button>
    </div>

    <button @click="add(fillControls.defaultFill)">Ajouter un remplissage</button>
  </PropertyListRoot>
</template>
```

## Règle pratique

- utiliser les composables pour la logique de contrôle directe
- utiliser les primitives structurelles quand la coordination de liste/arbre/slot répétée est la partie complexe

## API associées

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
