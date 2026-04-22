---
title: useEffectsControls
description: Helpers du panneau d'effets pour les ombres, flous, état d'expansion et flux de glissement/validation.
---

# useEffectsControls

`useEffectsControls()` est le composable de propriété d'effets utilisé par les panneaux d'effets.

Il fournit des helpers pour :

- les effets par défaut
- la logique ombre versus flou
- l'état d'expansion des éléments
- l'édition par aperçu de glissement
- les mises à jour de validation à la fin
- les changements de type et de couleur d'effet

## Utilisation

```ts
import { useEffectsControls } from '@open-pencil/vue'

const effects = useEffectsControls()
```

## Exemple de base

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()
```

## Exemples pratiques

### Ajouter un effet par défaut

```ts
const effect = effects.createDefaultEffect()
```

### Prévisualiser les changements par glissement, puis valider

```ts
effects.scrubEffect(node, index, { radius: 12 })
effects.commitEffect(node, index, { radius: 12 })
```

## API associées

- [PropertyListRoot](../components/property-list-root)
