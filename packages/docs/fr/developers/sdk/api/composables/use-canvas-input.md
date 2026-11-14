---
title: useCanvasInput
description: Relier pointeur, glissement, sélection, taille, rotation et outils à la zone de travail.
---

# useCanvasInput

`useCanvasInput(options)` relie les événements de l’élément au système de saisie de l’éditeur :

- mouvement, pression et relâchement du pointeur ;
- sélection et rectangle de sélection ;
- déplacement de la vue et zoom ;
- glissement des objets ;
- redimensionnement et rotation ;
- outils de formes, Plume, Texte et Main ;
- édition vectorielle et textuelle.

Le composable convertit les coordonnées d’écran en coordonnées de la zone de travail et conserve la capture du pointeur pendant une interaction.

Cette API de bas niveau est principalement destinée aux composants qui contiennent la zone de travail d’une interface propre.

## Voir aussi

- [useCanvas](./use-canvas)
- [useTextEdit](./use-text-edit)
