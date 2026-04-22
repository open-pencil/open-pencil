---
title: useTypography
description: Lit et met à jour la famille de polices, le poids, la taille, l'alignement et la mise en forme des nœuds texte.
---

# useTypography

`useTypography()` est le composable de contrôle des propriétés de texte pour les panneaux d'édition de texte.

Il expose :

- la famille de polices
- le poids de la police
- la taille de la police
- l'état de mise en forme
- le statut des polices manquantes
- des helpers pour changer la famille, le poids, l'alignement et les décorations

## Utilisation

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Exemple de base

```ts
const {
  fontFamily,
  fontWeight,
  fontSize,
  activeFormatting,
  setFamily,
  setWeight,
  setAlign,
} = useTypography()
```

## Exemples pratiques

### Charger et changer une famille de polices

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Basculer la mise en forme

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## API associées

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
