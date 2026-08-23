---
title: Exporter avec la CLI
description: Générer images, SVG, HTML et autres sorties sans ouvrir l’éditeur.
---

# Exporter avec la CLI

`export` produit le rendu d’une page ou d’un objet depuis un fichier compatible.

```sh
bun open-pencil export design.fig -o preview.png
```

## Choisir le contenu

Les options de la commande permettent de sélectionner une page, un identifiant ou un objet trouvé. Le format est déduit de l’extension ou indiqué explicitement.

## Échelle et dimensions

L’échelle contrôle la résolution. Une largeur ou une hauteur peut aussi être fixée ; les proportions sont conservées lorsqu’une seule dimension est fournie.

## SVG

SVG préserve la géométrie vectorielle et convient aux icônes, à la revue et aux modifications ultérieures.

## HTML

L’exportation HTML crée un document autonome avec la structure et les styles disponibles. Elle vise la transmission, l’inspection et les traitements ultérieurs, pas le remplacement à l’identique du rendu CanvasKit. Elle n’est disponible qu’en mode fichier.

## Chemin de sortie

`-o` ou `--output` définit le chemin. La CLI signale les erreurs de format, les objets introuvables et les chemins invalides au lieu de produire silencieusement un résultat incomplet.

Consultez `bun open-pencil export --help` pour les formats et options de la version installée.
