---
title: useTextEdit
description: Gère l'édition DOM de texte, la composition, la mise en forme et la synchronisation pour les nœuds texte du canvas.
---

# useTextEdit

`useTextEdit()` fait le pont entre la saisie de texte DOM et le modèle d'édition de texte canvas de l'éditeur.

Il coordonne :

- la saisie de texte via textarea
- la composition IME
- le clignotement du curseur
- le comportement supprimer/retour arrière
- les commandes de mise en forme comme gras/italique/souligné
- la synchronisation des modifications de texte dans le graphe

## Utilisation

```ts
useTextEdit(canvasRef, editor)
```

## Exemple de base

Utilisez-le dans le composant propriétaire du canvas avec `useCanvas()` et `useCanvasInput()`.

## Exemples pratiques

### Prendre en charge les raccourcis de mise en forme

`useTextEdit()` gère déjà les actions de mise en forme clavier comme gras, italique et souligné pendant que l'édition de texte est active.

### Garder canvas et éditeur de texte synchronisés

Il met à jour le texte du graphe et les passages de style au fur et à mesure que l'utilisateur tape ou édite des plages mises en forme.

## Notes

C'est un composable d'intégration canvas/éditeur, pas un composable générique de champ de texte.

## API associées

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
