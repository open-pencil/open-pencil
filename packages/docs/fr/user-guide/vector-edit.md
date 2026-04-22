---
title: Édition d'objets vectoriels
description: "Comment modifier la géométrie d'un tracé vectoriel : ancres, poignées de Bézier, modificateurs et actions de l'outil Plume en mode édition."
---

# Édition d'objets vectoriels

Le mode Édition d'objets vectoriels permet de modifier la **géométrie** d'une courbe : positions des ancres, forme des segments et poignées de Bézier.  
Dans ce mode, vous éditez le tracé lui-même, et non les transformations standard de l'objet.

## Entrer dans le mode

- Sélectionnez un objet vectoriel avec l'outil Sélection.
- **Double-cliquez sur la courbe**.

La modification de géométrie est alors activée pour le vecteur sélectionné.

## Quitter le mode

- Appuyez sur <kbd>Échap</kbd>.
- Ou basculez vers un autre contexte d'édition.

## Ce qui change dans ce mode

- Le cadre de transformation habituel est désactivé pour l'objet.
- L'édition des ancres, des segments et des poignées devient disponible.
- Le curseur ne passe plus en mode redimensionnement/rotation aux coins du cadre englobant.

## Actions de base

### Déplacer une ancre

- Faites glisser un point d'ancrage.
- Les segments connectés et la forme du tracé sont mis à jour en temps réel dans l'aperçu.

### Modifier une poignée de Bézier

- Faites glisser une poignée sur l'ancre.
- Par défaut, le comportement suit la composition de poignées actuelle de l'ancre.

## Modificateurs de déplacement des poignées

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Continu (Lisse / Continu) | <kbd>Cmd</kbd> + glisser | <kbd>Ctrl</kbd> + glisser |
| Coin (poignées indépendantes) | <kbd>Option</kbd> + glisser | <kbd>Alt</kbd> + glisser |
| Verrouillage de direction (longueur uniquement) | <kbd>Shift</kbd> + glisser | <kbd>Shift</kbd> + glisser |

### Continu : <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + glisser

- La poignée active est contrainte sur la même ligne que la poignée opposée.
- Seule la longueur de la poignée active change.
- Utilisez ce mode pour des transitions fluides sans rupture de coin.

### Coin : <kbd>Option</kbd>/<kbd>Alt</kbd> + glisser

- La poignée active est éditée de façon indépendante.
- La poignée opposée reste en place.
- Utilisez ce mode pour créer une transition en coin net.

### Verrouillage de direction : <kbd>Shift</kbd> + glisser

Pour les ancres dont la composition est **Continu** ou **Symétrique** :

- la direction de la poignée est verrouillée sur la valeur d'**avant le début du glissement en cours** ;
- le glissement ne modifie que la longueur de la poignée (ou des poignées, selon la composition).

## Remplacement de courbure par déplacement d'ancre

Lorsque vous faites glisser une ancre en maintenant <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>, l'éditeur sélectionne la poignée cible en fonction de la **direction d'attache du segment** au niveau de cette ancre (et non par la distance au point voisin le plus proche).  
Cela fonctionne également sur les ancres de réseau vectoriel multi-branches : une fois résolue, la poignée cible reste verrouillée pour le glissement en cours.

## Utiliser l'outil Plume en mode édition

Avec l'outil Plume actif :

- **Cliquez sur un segment** pour insérer une nouvelle ancre (diviser le segment).
- **Cliquez sur l'extrémité d'un tracé ouvert** pour reprendre le dessin depuis ce point.
- **Option/Alt + clic sur une ancre** pour la supprimer (lorsque la topologie le permet).

Pour le comportement de création et de fermeture de tracés, voir [Outil Plume](./pen-tool.md).

## Flux de travail pratique

1. Dessinez une forme avec l'outil Plume.
2. Double-cliquez sur la courbe pour entrer en mode Édition d'objets vectoriels.
3. Déplacez les ancres pour affiner la silhouette.
4. Faites glisser les poignées :
   - avec <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> pour des transitions continues et fluides,
   - avec <kbd>Option</kbd>/<kbd>Alt</kbd> pour des modifications indépendantes,
   - avec <kbd>Shift</kbd> pour modifier uniquement la longueur.
5. Appuyez sur <kbd>Échap</kbd> pour quitter.
