---
title: Analyser des designs
description: Auditez les couleurs, la typographie, l'espacement et les motifs récurrents dans les fichiers .fig.
---

# Analyser des designs

Les commandes `analyze` permettent d'auditer un système de design entier depuis le terminal — trouvez les incohérences, extrayez la vraie palette, repérez les composants qui attendent d'être extraits.

## Couleurs

```sh
open-pencil analyze colors design.fig
```

Trouve chaque couleur dans le fichier, compte les utilisations et affiche un histogramme visuel :

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×
```

## Typographie

```sh
open-pencil analyze typography design.fig
```

Liste chaque combinaison de famille de polices, taille et graisse avec le nombre d'utilisations. Utile pour repérer les styles de texte ponctuels qui devraient être consolidés.

## Espacement

```sh
open-pencil analyze spacing design.fig
```

Audite les valeurs de gap et de padding à travers les frames avec auto-layout. Aide à identifier les incohérences d'échelle d'espacement — par exemple, un gap de `13px` isolé parmi des valeurs de `8/16/24`.

## Motifs récurrents

```sh
open-pencil analyze clusters design.fig
```

Trouve les motifs de nœuds répétés qui pourraient être extraits en composants :

```
3771× frame "container" (100% match)
     size: 40×40, structure: Frame > [Frame]

2982× instance "Checkboxes" (100% match)
     size: 48×48, structure: Instance > [Frame]
```

## Sortie JSON

Toutes les commandes d'analyse supportent `--json` pour une sortie lisible par machine :

```sh
open-pencil analyze colors design.fig --json
```

Redirigez vers `jq`, alimentez des vérifications CI, ou utilisez dans des scripts qui contrôlent les budgets de tokens de design.
