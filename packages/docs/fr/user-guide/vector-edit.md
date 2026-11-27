---
pageClass: guide
title: Édition vectorielle
description: Déplacez les points et les courbes d’un tracé, ajoutez et supprimez des points, et combinez des formes pour en créer de nouvelles.
---

# Édition vectorielle

Un tracé est fait de points reliés par des lignes droites ou courbes. Pour changer sa forme, modifiez les points eux-mêmes.

## Modifier un tracé

Double-cliquez sur un tracé, ou sélectionnez-le et appuyez sur <Keys mac="Enter" other="Enter" />. Ses points apparaissent et les poignées autour du calque disparaissent.

<GuideImage name="vector-edit/points" alt="Un tracé courbe en mode édition, avec un point sélectionné et ses deux poignées" />

- Faites glisser un point pour le déplacer.
- Faites glisser la poignée d’un point pour changer la courbe.
- Cliquez sur une ligne entre deux points pour la sélectionner, et faites-la glisser pour déplacer ses deux points.
- Faites glisser sur une zone vide pour sélectionner les points à l’intérieur du rectangle.
- Dans une forme remplie, la zone sous le pointeur est hachurée. Cliquez pour la sélectionner avec tous ses points, et faites glisser pour la déplacer.
- Maintenez <Keys mac="⇧" other="Shift" /> et cliquez pour ajouter à la sélection.

Pour arrêter l’édition, appuyez sur <Keys mac="Esc" other="Esc" /> ou <Keys mac="Enter" other="Enter" />, ou cliquez sur une partie vide du canevas.

## Façonner une courbe

Maintenez une touche pendant que vous faites glisser une poignée :

| Touche | Effet |
| ---- | ------------ |
| <Keys mac="⌘" other="Ctrl" /> | Garde les deux poignées alignées, pour une courbe lisse. Seule la longueur de cette poignée change. |
| <Keys mac="⌥" other="Alt" /> | Déplace seulement cette poignée, pour un angle vif. |
| <Keys mac="⇧" other="Shift" /> | Garde la direction de la poignée et ne change que sa longueur. |

Maintenez <Keys mac="⌘" other="Ctrl" /> et faites glisser un point pour en faire sortir les poignées et courber les lignes voisines.

## Ajouter et supprimer des points

Appuyez sur <Keys mac="P" other="P" /> pendant l’édition pour utiliser la plume :

- Cliquez sur une ligne pour y ajouter un point.
- Cliquez sur l’extrémité d’un tracé ouvert pour continuer à dessiner à partir de là.
- Maintenez <Keys mac="⌥" other="Alt" /> et cliquez sur un point pour le supprimer.

Pour supprimer la sélection, appuyez sur <Keys mac="⌫" other="Delete" />. Un point supprimé emporte ses lignes avec lui. Une ligne supprimée laisse ses points, sauf si rien d’autre ne les retient : supprimer une ligne au milieu coupe donc un tracé en deux. Pour couper plutôt un tracé au niveau d’un point, sélectionnez le point et appuyez sur <Keys mac="⌥ ⌫" other="Alt Delete" />.

## Combiner des formes

Sélectionnez au moins deux formes et choisissez comment les combiner dans **Objet** :

<GuideImage name="vector-edit/combine" alt="Un carré et un cercle qui se chevauchent, et les quatre façons de les combiner : union, soustraction, intersection et exclusion" />

- **Union de la sélection** les réunit en une seule forme.
- **Soustraire la sélection** découpe les formes du dessus dans celle du dessous.
- **Intersection de la sélection** ne garde que la partie où elles se chevauchent.
- **Exclure la sélection** garde tout sauf la partie où elles se chevauchent.

Le résultat reste modifiable : chaque forme garde ses propres points à l’intérieur. **Aplatir** transforme la sélection en un seul tracé simple, et **Vectoriser le contour** transforme un contour en une forme remplie. Une fois aplatis, les rectangles, ellipses et étoiles deviennent des tracés que vous pouvez modifier point par point.
