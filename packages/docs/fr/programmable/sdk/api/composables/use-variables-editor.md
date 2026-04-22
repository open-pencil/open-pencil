---
title: useVariablesEditor
description: Compose l'état du dialogue variables, les colonnes de tableau et le câblage TanStack table.
---

# useVariablesEditor

`useVariablesEditor()` est un composable de domaine variables de plus haut niveau pour construire un dialogue ou un écran d'édition de variables.

Il combine :

- l'état du dialogue variables
- les colonnes du tableau de variables
- le câblage TanStack Vue Table
- les helpers de collection/mode

## Utilisation

```ts
const variables = useVariablesEditor({
  colorInput: ColorInput,
  icons,
  fallbackIcon,
  deleteIcon,
})
```

## Ce qu'il retourne

Il inclut l'état de dialogue/tableau de bas niveau ainsi que :

- `columns`
- `table`
- `hasCollections`

## Exemples pratiques

### Construire un dialogue de variables

Utilisez `useVariablesEditor()` quand vous voulez un seul composable qui câble déjà le tableau et les handlers d'action ensemble.

## API associées

- [Aperçu de l'API SDK](../)
