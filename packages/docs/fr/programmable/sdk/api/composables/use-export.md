---
title: useExport
description: Gère les paramètres d'export comme l'échelle et le format pour la sélection courante.
---

# useExport

`useExport()` est le composable du panneau d'export pour les nœuds sélectionnés.

Il gère :

- les lignes de paramètres d'export
- les identifiants des nœuds sélectionnés
- l'étiquetage du nom d'export
- les échelles et formats supportés

## Utilisation

```ts
import { useExport } from '@open-pencil/vue'

const exportState = useExport()
```

## Exemple de base

```ts
const {
  settings,
  nodeName,
  scales,
  formats,
  addSetting,
  updateScale,
  updateFormat,
} = useExport()
```

## Exemples pratiques

### Ajouter un autre préréglage d'export

```ts
exportState.addSetting()
```

### Changer le premier export en 2x WEBP

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## API associées

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
