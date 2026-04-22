---
title: useLayout
description: Travaillez avec l'auto-layout, le dimensionnement, les marges internes, l'alignement et les pistes de grille.
---

# useLayout

`useLayout()` est le composable de contrôle principal pour les panneaux liés au layout.

Il expose l'état et les actions pour :

- le mode flex ou grille
- le dimensionnement largeur/hauteur
- les marges internes
- l'alignement
- l'édition des pistes de template de grille

## Utilisation

```ts
import { useLayout } from '@open-pencil/vue'

const layout = useLayout()
```

## Exemple de base

```ts
const {
  isGrid,
  isFlex,
  widthSizing,
  heightSizing,
  setWidthSizing,
  setHeightSizing,
} = useLayout()
```

## Exemples pratiques

### Basculer entre les marges internes uniformes et individuelles

```ts
layout.toggleIndividualPadding()
```

### Mettre à jour les pistes de grille

```ts
layout.updateGridTrack('gridTemplateColumns', 0, { sizing: 'FIXED', value: 240 })
layout.addTrack('gridTemplateRows')
```

### Changer l'alignement

```ts
layout.setAlignment('CENTER', 'MAX')
```

## API associées

- [usePosition](./use-position)
- [useEditor](./use-editor)
