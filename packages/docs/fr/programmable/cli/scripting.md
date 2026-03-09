---
title: Scripter
description: Exécutez du JavaScript avec l'API Figma Plugin — interrogez des nœuds, modifiez des designs en lot, créez des frames.
---

# Scripter

`open-pencil eval` vous donne accès à l'API complète Figma Plugin dans le terminal. Lisez des nœuds, modifiez des propriétés, créez des formes — puis écrivez les changements dans le fichier.

## Utilisation de base

```sh
open-pencil eval design.fig -c "figma.currentPage.children.length"
```

L'option `-c` prend du JavaScript. Le global `figma` fonctionne comme l'API Figma Plugin.

## Interroger des nœuds

```sh
open-pencil eval design.fig -c "
  figma.currentPage.findAll(n => n.type === 'FRAME' && n.name.includes('Button'))
    .map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
"
```

## Modifier et sauvegarder

```sh
open-pencil eval design.fig -c "
  figma.currentPage.children.forEach(n => n.opacity = 0.5)
" -w
```

`-w` écrit les changements dans le fichier d'entrée. Utilisez `-o output.fig` pour écrire dans un fichier différent.

## Lire depuis l'entrée standard

Pour des scripts plus longs :

```sh
cat transform.js | open-pencil eval design.fig --stdin -w
```

## Mode application en direct

Omettez le fichier pour exécuter sur l'application de bureau en cours d'exécution :

```sh
open-pencil eval -c "figma.currentPage.name"
```

## API disponible

L'objet `figma` supporte :

- `figma.currentPage` — la page active
- `figma.root` — la racine du document
- `figma.createFrame()`, `figma.createRectangle()`, `figma.createEllipse()`, `figma.createText()`, etc.
- `.findAll()`, `.findOne()` — rechercher dans les descendants
- `.appendChild()`, `.insertChild()` — manipulation de l'arborescence
- Tous les setters de propriétés : `.fills`, `.strokes`, `.effects`, `.opacity`, `.cornerRadius`, `.layoutMode`, `.itemSpacing`, etc.

C'est la même API que celle utilisée par les plugins Figma, donc les connaissances et les extraits de code existants sont directement transférables.

## Sortie JSON

```sh
open-pencil eval design.fig -c "..." --json
```
