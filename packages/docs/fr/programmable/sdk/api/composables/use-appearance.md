---
title: useAppearance
description: Contrôle la visibilité, l'opacité et le rayon de coin de la sélection courante.
---

# useAppearance

`useAppearance()` est le composable de contrôle axé sur l'apparence pour les panneaux de propriétés.

Il expose l'état UI dérivé de la sélection pour :

- la visibilité
- l'opacité
- le rayon de coin
- les rayons de coin indépendants

## Utilisation

```ts
import { useAppearance } from '@open-pencil/vue'

const appearance = useAppearance()
```

## Exemple de base

```ts
const {
  visibilityState,
  opacityPercent,
  cornerRadiusValue,
  toggleVisibility,
  toggleIndependentCorners,
} = useAppearance()
```

## Exemples pratiques

### Basculer la visibilité de la sélection

```ts
appearance.toggleVisibility()
```

### Éditer les rayons de coin individuels

```ts
appearance.updateCornerProp('topLeftRadius', 12)
appearance.commitCornerProp('topLeftRadius', 12, 8)
```

## API associées

- [Aperçu de l'API SDK](../)
- [useLayout](./use-layout)
- [useTypography](./use-typography)
