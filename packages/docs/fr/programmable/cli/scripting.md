---
title: Scripting
description: Exécuter JavaScript avec une API compatible avec les plugins Figma pour interroger, modifier et générer des designs.
---

# Scripting

`openpencil eval` exécute JavaScript sur un document et fournit un objet global `figma`. Cette commande convient aux modifications par lots, à l’inspection, aux données de test et à l’automatisation sans ouvrir l’interface de l’éditeur.

## Utilisation de base

```sh
openpencil eval design.fig -c "return figma.currentPage.children.length"
```

`-c` accepte JavaScript. Si le code ne commence pas par `return`, OpenPencil l’exécute dans une fonction asynchrone et renvoie le résultat éventuel.

## Interroger des objets

```sh
openpencil eval design.fig -c "
  return figma.currentPage
    .findAll((node) => node.type === 'FRAME')
    .map((node) => ({ id: node.id, name: node.name }))
"
```

## Modifier et enregistrer

`--write` ou `-w` remplace le fichier d’entrée. `--output` ou `-o` crée un autre fichier.

```sh
openpencil eval design.fig -c "figma.currentPage.name = 'Updated'" -o updated.fig
```

## Lire le script depuis stdin

```sh
cat transform.js | openpencil eval design.fig --stdin --write
```

## Document ouvert

Omettez le chemin pour exécuter le script sur le document actif dans l’application de bureau.

## Sortie

Dans un environnement non interactif, `eval` utilise JSON par défaut. `--json` l’impose explicitement et `--quiet` ou `-q` masque la sortie lorsqu’un fichier seul est écrit.

## API compatible

L’API suit le modèle de Figma Plugin API, mais agit sur SceneGraph et les formats OpenPencil. Elle couvre document, pages, création d’objets, opérations d’arbre, composants, variables et propriétés courantes.

Les identifiants exacts comme `figma.currentPage`, `createFrame`, `appendChild`, `fills`, `fontSize`, `layoutMode` et `strokeWeight` restent inchangés.

## Limites

Il n’existe pas encore d’équivalent complet pour `node.exportAsync()`, `node.setBoundVariable()`, `node.detachInstance()`, `figma.combineAsVariants()`, les styles de peinture/texte et toutes les opérations booléennes vectorielles.

Selon le besoin, utilisez aussi la commande d’exportation, les outils du noyau ou les opérations directes de SceneGraph.
