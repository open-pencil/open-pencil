---
title: Panneaux de propriétés
description: Créer des panneaux de propriétés avec des composables et des composants sans apparence imposée.
---

# Panneaux de propriétés

`@open-pencil/vue` fournit principalement des composables pour les panneaux de propriétés.

Si un panneau utilise des valeurs calculées depuis la sélection et des actions pour les modifier, choisissez un composable. Pour une structure réutilisable de tableau ou de liste, utilisez un composant sans apparence imposée comme `PropertyListRoot`.

## Composables

Pour les sections courantes :

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Pour les propriétés sous forme de listes :

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Liaisons avec des variables

Lorsqu’un champ peut être lié à une variable ou à un jeton de design externe, placez-le dans `BindableValueRoot`.

- Hors édition, affichez le nom de la variable ; la valeur calculée peut apparaître dans une infobulle.
- Le focus et l’ouverture du sélecteur de variable ne doivent pas supprimer une liaison existante.
- N’appliquez `detach-on-edit`, `readonly-when-bound` ou `edit-variable` qu’après une modification réelle.
- Une action explicite de suppression de la liaison est préférable dans le sélecteur à un bouton facile à déclencher par erreur près du champ.
- Regroupez changement de liaison, détachement pendant l’édition et mises à jour de plusieurs objets dans une seule opération groupée du fournisseur.

L’application OpenPencil affiche le nom de la variable en violet lorsque le champ est inactif. Au début de l’édition, `NumberField` affiche la valeur numérique calculée. Une interface personnalisée peut présenter le même état différemment.

## Exemple : position et taille

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

## Exemple : remplissages

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
      <button @click="actions.remove(index)">Supprimer</button>
    </div>

    <button @click="actions.add(fillControls.defaultFill)">Ajouter un remplissage</button>
  </PropertyListRoot>
</template>
```

## Choisir l’API

- Composables pour l’état et les actions.
- Composants structurels sans apparence imposée lorsque la coordination de listes, arbres ou slots répétitifs constitue l’essentiel du travail.

## Voir aussi

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
