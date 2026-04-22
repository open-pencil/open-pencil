---
title: useFillControls
description: Composable du panneau de remplissages avec le comportement de remplissage par défaut.
---

# useFillControls

`useFillControls()` est le composable de propriété de remplissage utilisé par les interfaces d'édition de remplissage.

Il ajoute une valeur de remplissage par défaut réutilisable.

## Utilisation

```ts
import { useFillControls } from '@open-pencil/vue'

const fills = useFillControls()
```

## Ce qu'il fournit

Il expose :

- `defaultFill`

## Exemples pratiques

### Ajouter une nouvelle ligne de remplissage

```ts
propertyList.add(fills.defaultFill)
```

## API associées

- [PropertyListRoot](../components/property-list-root)
