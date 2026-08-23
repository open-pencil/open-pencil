---
title: useCanvas
description: Créer et maintenir la surface CanvasKit de l’éditeur.
---

# useCanvas

`useCanvas(options)` relie un élément `<canvas>` au moteur de rendu. Il se charge de :

- charger CanvasKit ;
- créer et recréer la surface ;
- observer les dimensions ;
- ajuster l’échelle des pixels ;
- demander les rafraîchissements ;
- libérer les ressources au démontage.

Les règles, la couleur de fond et le comportement d’un aperçu intégré sont configurables.

Utilisez `CanvasRoot` et `CanvasSurface` pour la composition habituelle, ou ce composable pour contrôler directement l’élément.

## Voir aussi

- [CanvasRoot](../components/canvas-root)
- [CanvasSurface](../components/canvas-surface)
- [useCanvasInput](./use-canvas-input)
