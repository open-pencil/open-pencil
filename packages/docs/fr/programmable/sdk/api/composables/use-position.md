---
title: usePosition
description: Lit et met à jour la position, la taille, la rotation, l'alignement et le retournement du nœud sélectionné.
---

# usePosition

`usePosition()` est un composable de contrôle pour les UI liées à la position.

Il expose les valeurs du nœud sélectionné comme :

- `x`
- `y`
- `width`
- `height`
- `rotation`

et des actions comme :

- aligner
- retourner
- faire pivoter
- glisser/mettre à jour des propriétés numériques

## Utilisation

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Exemple de base

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Exemples pratiques

### Aligner les nœuds sélectionnés

```ts
position.align('horizontal', 'center')
position.align('vertical', 'min')
```

### Retourner la sélection

```ts
position.flip('horizontal')
position.flip('vertical')
```

### Faire pivoter la sélection

```ts
position.rotate(90)
```

## API associées

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
