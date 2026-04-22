---
title: useVariablesTable
description: Construit les définitions de colonnes TanStack Table pour les interfaces de variables OpenPencil.
---

# useVariablesTable

`useVariablesTable(options)` retourne des définitions de colonnes TanStack Table réactives pour les éditeurs de variables.

Utilisez-le quand vous voulez le comportement du tableau de variables du SDK mais que vous devez fournir votre propre instance de tableau, des icônes personnalisées ou des composants shell spécifiques à votre application.

## Utilisation

```ts
import { useVariablesTable } from '@open-pencil/vue'

const { columns } = useVariablesTable(options)
```

## Notes

- c'est un helper d'intégration spécialisé pour les interfaces de variables pilotées par tableau
- la plupart des consommateurs devraient commencer par `useVariablesEditor()` sauf s'ils ont besoin d'un contrôle plus fin

## API associées

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
