---
title: Analyser des documents avec la CLI
description: Détecter couleurs, typographies, espacements et structures répétées.
---

# Analyser des documents avec la CLI

Les sous-commandes `analyze` examinent le document complet et aident à repérer les incohérences ou les structures qui pourraient devenir des composants.

## Couleurs

```sh
bun open-pencil analyze colors design.fig
```

Regroupe les couleurs des remplissages et contours, compte leurs utilisations et révèle les teintes presque identiques.

## Typographie

```sh
bun open-pencil analyze typography design.fig
```

Énumère les combinaisons de famille, taille et style avec leur fréquence afin d’identifier les styles isolés.

## Espacement

```sh
bun open-pencil analyze spacing design.fig
```

Examine espacements et marges intérieures des cadres à disposition automatique. Une valeur `13px` au milieu d’une échelle `8/16/24` devient ainsi visible.

## Structures répétées

```sh
bun open-pencil analyze clusters design.fig
```

Recherche des hiérarchies similaires susceptibles de devenir des composants et affiche leur correspondance, leur taille et leur structure.

## Sortie JSON

Ajoutez `--json` pour traiter les résultats en CI, produire des rapports ou appliquer vos propres règles.

Ces analyses ne modifient pas le fichier. Pour les transformations, utilisez [`eval`](./scripting).
