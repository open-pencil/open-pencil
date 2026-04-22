---
title: useStrokeControls
description: Helpers du panneau de contours pour l'alignement, la sélection de côté et les épaisseurs de contour par côté.
---

# useStrokeControls

`useStrokeControls()` est le composable de propriété de contour utilisé par les panneaux d'édition de contours.

Il fournit :

- les options d'alignement du contour
- les préréglages de côté : tous, haut, bas, gauche, droite, personnalisé
- les données de contour par défaut
- des helpers pour les épaisseurs de bordure par côté

## Utilisation

```ts
import { useStrokeControls } from '@open-pencil/vue'

const strokes = useStrokeControls()
```

## Exemple de base

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
```

## Exemples pratiques

### Définir l'alignement du contour

```ts
strokes.updateAlign('INSIDE', activeNode)
```

### Limiter un contour à un seul côté

```ts
strokes.selectSide('TOP', activeNode)
```

## API associées

- [PropertyListRoot](../components/property-list-root)
