---
title: useColorVariableBinding
description: Helper de liaison de variables pour les éditeurs de couleur de remplissage et de contour.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` expose des helpers de recherche, liaison et déliaison pour les variables de couleur utilisées par les éditeurs de remplissage et de contour.

Utilisez-le pour construire des interfaces de couleur qui ont besoin de connecter des remplissages ou des contours à des variables de design.

## Utilisation

```ts
import { useColorVariableBinding } from '@open-pencil/vue'

const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## API associées

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [FillPickerRoot](../components/fill-picker-root)
