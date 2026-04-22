---
title: useOkHCL
description: Travaillez avec les modèles de couleur RGBA et OkHCL pour les remplissages et contours.
---

# useOkHCL

`useOkHCL()` expose des helpers pour lire, activer, désactiver et mettre à jour les valeurs de couleur OkHCL sur les remplissages et contours des nœuds.

Utilisez-le quand vous construisez des outils de couleur avancés qui ont besoin de basculer entre l'édition RGBA standard et l'édition OkHCL perceptuelle.

## Utilisation

```ts
import { useOkHCL } from '@open-pencil/vue'

const okhcl = useOkHCL()
```

## Retourne

- `getFillColorModel()`
- `getStrokeColorModel()`
- `getFillOkHCLColor()`
- `getStrokeOkHCLColor()`
- `enableFillOkHCL()`
- `disableFillOkHCL()`
- `enableStrokeOkHCL()`
- `disableStrokeOkHCL()`
- `updateFillOkHCL()`
- `updateStrokeOkHCL()`
- `modelOptions`

## API associées

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
