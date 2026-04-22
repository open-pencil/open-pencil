---
title: useCanvasInput
description: "Câble les interactions pointeur du canvas : glisser, sélectionner, redimensionner, rotation et comportement des outils."
---

# useCanvasInput

`useCanvasInput()` connecte les interactions pointeur et souris au canvas de l'éditeur.

Il gère les préoccupations d'interaction comme :

- la sélection
- le glissement
- le redimensionnement
- la rotation
- le panoramique
- les flux de dessin au stylo
- l'interaction de l'édition de texte
- le test de collision sensible à la portée

## Utilisation

Ce composable est généralement associé à `useCanvas()` et aux helpers de test de collision du renderer.

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
)
```

## Exemple de base

```ts
const canvas = useCanvas(canvasRef, editor)

useCanvasInput(
  canvasRef,
  editor,
  canvas.hitTestSectionTitle,
  canvas.hitTestComponentLabel,
  canvas.hitTestFrameTitle,
)
```

## Exemples pratiques

### Suivre le mouvement du curseur dans l'espace canvas

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  (cx, cy) => {
    console.log(cx, cy)
  },
)
```

## Notes

Ce composable est plus bas niveau que la plupart des logiques de panneau. Il est mieux adapté aux shells d'éditeur et aux conteneurs canvas.

## API associées

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
