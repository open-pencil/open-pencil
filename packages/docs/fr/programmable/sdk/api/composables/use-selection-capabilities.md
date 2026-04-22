---
title: useSelectionCapabilities
description: Dérive des booléens adaptés aux commandes pour les UI et actions pilotées par la sélection.
---

# useSelectionCapabilities

`useSelectionCapabilities()` expose des booléens réactifs indiquant si les actions éditeur courantes sont actuellement autorisées.

Utilisez-le pour construire :

- des menus
- des barres d'outils
- des raccourcis clavier
- des boutons d'action
- des panneaux contextuels

## Utilisation

```ts
import { useSelectionCapabilities } from '@open-pencil/vue'

const caps = useSelectionCapabilities()
```

## Exemple de base

```vue
<script setup lang="ts">
import { useSelectionCapabilities } from '@open-pencil/vue'

const { canDelete, canDuplicate, canCreateComponent } = useSelectionCapabilities()
</script>

<template>
  <div class="flex gap-2">
    <button :disabled="!canDuplicate">Dupliquer</button>
    <button :disabled="!canDelete">Supprimer</button>
    <button :disabled="!canCreateComponent">Créer un composant</button>
  </div>
</template>
```

## Exemples pratiques

### Conditionner les entrées de menu

```ts
const { canMoveToPage, canGoToMainComponent } = useSelectionCapabilities()
```

### Activer les commandes de zoom uniquement quand utile

```ts
const { canZoomToSelection } = useSelectionCapabilities()
```

## API associées

- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)
