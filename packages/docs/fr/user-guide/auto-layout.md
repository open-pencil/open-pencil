---
title: Mise en page auto
description: Layout flex et grille dans Inkly — direction, espacement, padding, alignement, dimensionnement et tracks CSS Grid.
---
# Mise en page auto

La mise en page auto positionne automatiquement les enfants dans un cadre. Deux modes sont pris en charge : **flex** (flux horizontal/vertical) et **grille** (lignes et colonnes avec dimensionnement de pistes).

<kbd>⇧</kbd><kbd>A</kbd> pour activer/désactiver ou envelopper la sélection.

## Direction
- **Horizontale** — de gauche à droite
- **Verticale** — de haut en bas
- **Retour à la ligne** — retour quand l'espace manque

## Espacement
**Gap** entre enfants adjacents. **Padding** entre bord du cadre et enfants.

## Alignement
- **Axe principal (Justify) :** début, centre, fin, espace entre
- **Axe transversal (Align) :** début, centre, fin, étirer

## Dimensionnement enfants
- **Fixe** — largeur/hauteur explicite
- **Remplir** — s'étend dans l'espace disponible
- **Ajuster** — se réduit au contenu

## CSS Grid

Le layout en grille organise les enfants en lignes et colonnes avec un dimensionnement de pistes explicite.

### Activer la grille

Sélectionnez un cadre avec auto-layout activé et cliquez sur l'icône grille dans la barre d'outils layout pour passer de flex à grille.

### Dimensionnement des pistes

Définissez les pistes de colonnes et de lignes avec trois modes :

- **fr** — unité fractionnaire, divise l'espace disponible proportionnellement
- **px** — taille fixe en pixels
- **auto** — s'adapte au contenu

### Espacement de la grille

Définissez des gaps horizontaux (colonnes) et verticaux (lignes) séparés entre les cellules.

### Positionnement des enfants

Les enfants sont placés dans les cellules de la grille automatiquement en ordre de ligne. Vous pouvez surcharger le placement avec des valeurs de début de colonne/ligne et d'étendue dans les propriétés layout de l'enfant.

### Export JSX et Tailwind

Les layouts en grille s'exportent en JSX avec des classes Tailwind : `grid grid-cols-3`, `gap-x-4 gap-y-2`, `col-start-2 row-span-2`.
