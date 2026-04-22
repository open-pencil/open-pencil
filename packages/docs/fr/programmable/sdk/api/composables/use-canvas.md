---
title: useCanvas
description: Attache le rendu CanvasKit à un élément canvas pour un éditeur OpenPencil.
---

# useCanvas

`useCanvas()` connecte un éditeur à un vrai élément `<canvas>`.

Il gère :

- l'initialisation de CanvasKit
- la création de surface
- la planification du rendu
- la gestion du redimensionnement
- la visibilité optionnelle des règles
- le callback de disponibilité du renderer

## Utilisation

```ts
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
```

## Exemple de base

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor } from '@open-pencil/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor, {
  showRulers: true,
  onReady: () => {
    console.log('Renderer prêt')
  },
})
</script>

<template>
  <canvas ref="canvasRef" class="size-full" />
</template>
```

## Exemples pratiques

### Désactiver les règles pour un aperçu intégré

```ts
useCanvas(canvasRef, editor, {
  showRulers: false,
})
```

### Conserver le tampon de dessin pour les captures d'écran

```ts
useCanvas(canvasRef, editor, {
  preserveDrawingBuffer: true,
})
```

## Notes

- `useCanvas()` est orienté renderer et pratiquement uniquement côté navigateur
- il est responsable du pipeline canvas en direct, pas des flux de fichiers au niveau applicatif
- il devrait généralement être associé à `useCanvasInput()` pour la gestion des interactions

## API associées

- [useEditor](./use-editor)
- [useCanvasInput](./use-canvas-input)
- [useTextEdit](./use-text-edit)

## Type

```ts
interface UseCanvasOptions {
  showRulers?: boolean
  preserveDrawingBuffer?: boolean
  onReady?: () => void
}

function useCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  options?: UseCanvasOptions,
): void
```
