---
title: useEditor
description: Accède à l'instance d'éditeur OpenPencil injectée courante.
---

# useEditor

`useEditor()` retourne l'éditeur OpenPencil injecté courant.

C'est le point d'entrée principal pour les composables SDK et les primitives headless qui ont besoin d'accéder à l'éditeur.

## Utilisation

`useEditor()` doit être appelé à l'intérieur d'un sous-arbre où `provideEditor(editor)` a déjà été appelé.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
```

## Exemple de base

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
const pageId = computed(() => editor.state.currentPageId)
</script>

<template>
  <div>Page courante : {{ pageId }}</div>
</template>
```

## Exemples pratiques

### Lire les nœuds sélectionnés

```ts
const editor = useEditor()
const selected = editor.getSelectedNodes()
```

### Déclencher des commandes

```ts
const editor = useEditor()
editor.zoomToFit()
editor.undoAction()
```

## Comportement en cas d'erreur

Si appelé en dehors d'un arbre de provider d'éditeur, `useEditor()` lève une exception avec un message explicite.

C'est intentionnel — cette API doit échouer bruyamment quand le contexte éditeur est absent.

## API associées

- [provideEditor](./provide-editor)
- [useCanvas](./use-canvas)
- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)

## Type

```ts
function useEditor(): Editor
```
