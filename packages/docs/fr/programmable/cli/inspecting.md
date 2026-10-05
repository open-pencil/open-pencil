---
title: Examiner des fichiers avec la CLI
description: Consulter pages, objets, hiérarchies, variables et formats des documents `.fig`.
---

# Examiner des fichiers avec la CLI

La CLI permet de comprendre la structure d’un fichier sans ouvrir l’éditeur.

```sh
bun open-pencil info design.fig
bun open-pencil pages design.fig
bun open-pencil tree design.fig
```

## Résumé

`info` affiche le format, la version, le nombre de pages et d’objets, la taille de la zone de travail, les polices, les variables et les principales métadonnées.

## Pages et arbre

`pages` énumère les pages. `tree` affiche la hiérarchie et peut limiter la profondeur, la page ou le nombre de résultats.

## Rechercher des objets

`find` recherche par nom, type ou autres critères.

```sh
bun open-pencil find design.fig --name Button
bun open-pencil find design.fig --type TEXT
```

## Afficher un objet

`node` affiche les propriétés de l’identifiant indiqué, notamment la géométrie, le style, les relations et les données propres à son type.

## Variables

`variables` énumère collections, modes, types et valeurs.

## Formats

`formats` affiche les formats enregistrés et leurs capacités de lecture et d’écriture.

## Mode application en direct

Lorsque l’application de bureau est lancée, omettez le fichier : la CLI se connecte via RPC et agit sur la zone de travail active :

```sh
openpencil documents list    # list open document/page IDs
openpencil tree              # inspect the active live document
openpencil tree --document-id tab-123 --page-id 0:1
openpencil eval --document-id tab-123 --page-id 0:1 -c "..."
```

Dans les workflows d’agents, utilisez `openpencil documents list --json`, puis passez explicitement `--document-id` et `--page-id` au lieu de vous fier à l’onglet ou à la page visibles. Pour ouvrir, enregistrer, changer et fermer des documents, annuler, modifier les réglages ou appeler un outil de l’éditeur, consultez [Piloter l’application](/programmable/cli/app-control).

## Analyser la qualité du design

```sh
openpencil lint design.fig
openpencil lint design.pen --preset strict
openpencil lint design.fig --rule color-contrast
openpencil lint design.fig --list-rules
openpencil lint design.fig --fix -o fixed.fig
```

Utilisez `--json` pour une sortie exploitable par une machine ; chaque message porte ses `fix` et `suggestions` sous forme de données. `--fix` applique les corrections sûres — liaison des couleurs à la variable de couleur correspondante et arrondi de la géométrie au pixel entier — et écrit le résultat dans le fichier `.fig` indiqué avec `-o`.

## Sortie JSON

Les commandes de consultation acceptent `--json`, adapté à `jq`, la CI et aux programmes qui nécessitent une sortie stable et exploitable par une machine.

```sh
bun open-pencil pages design.fig --json | jq '.[].name'
```

Utilisez `bun open-pencil --help` ou ajoutez `--help` à une sous-commande pour voir toutes les options.
