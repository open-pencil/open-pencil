---
title: useTextEdit
description: Relier l’édition directe de texte à une zone de travail propre.
---

# useTextEdit

`useTextEdit(options)` coordonne focus, saisie, composition IME, sélection, presse-papiers et sortie du mode d’édition.

Utilisez-le dans le composant qui contient la zone de travail, généralement avec `useCanvas()` et `useCanvasInput()`.

L’éditeur conserve le texte et ses plages de mise en forme dans une seule opération d’annulation.

## Voir aussi

- [useCanvasInput](./use-canvas-input)
- [Modifier du texte](/user-guide/text-editing)
