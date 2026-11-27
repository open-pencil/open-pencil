---
pageClass: guide
title: Outil plume
description: Dessinez des tracés faits de lignes droites et de courbes avec la plume, ou dessinez à main levée avec le crayon.
---

# Outil plume

La plume dessine un tracé point par point : des lignes droites, des courbes, ou les deux. Le crayon dessine à main levée, comme sur du papier.

## Dessiner un tracé

1. Appuyez sur <Keys mac="P" other="P" />.
2. Cliquez pour placer un point. Chaque clic ajoute une ligne droite depuis le point précédent.
3. Faites glisser au lieu de cliquer pour créer une courbe. La direction et la longueur du glissement définissent sa forme. Maintenez <Keys mac="Space" other="Space" /> pendant le glissement pour déplacer le point lui-même.
4. Terminez le tracé :
   - Cliquez sur le premier point pour le fermer en une forme, qui peut avoir un remplissage.
   - Appuyez sur <Keys mac="Esc" other="Esc" /> ou <Keys mac="Enter" other="Enter" /> pour le laisser ouvert, comme une ligne.

<GuidePair>

<GuideImage name="pen-tool/drawing" alt="Un tracé en cours de dessin : deux points placés, une courbe avec ses poignées et une ligne jusqu’au pointeur" caption="Pendant le dessin" />
<GuideImage name="pen-tool/done" alt="Le tracé ouvert terminé, sélectionné" caption="Le tracé terminé" />

</GuidePair>

Pendant le dessin, <Keys mac="⌘ Z" other="Ctrl Z" /> retire le dernier point. Pour modifier un tracé plus tard, [modifiez ses points](./vector-edit).

## Dessiner à main levée

Appuyez sur <Keys mac="⇧ P" other="Shift P" />, ou choisissez **Crayon** dans le menu de la plume de la barre d’outils, et faites glisser.

- Chaque trait devient un tracé distinct, lissé en courbes que vous pouvez modifier comme n’importe quel autre tracé. Le crayon reste actif pour le trait suivant.
- Maintenez <Keys mac="⇧" other="Shift" /> pour dessiner tout droit, à l’horizontale ou à la verticale, depuis le point où vous l’avez enfoncée.
- Terminez un trait là où il a commencé pour le fermer en une forme.
- Zoomez pour conserver plus de détails : la courbe suit votre main à quelques pixels près à l’écran.
- Un trait entre dans le cadre qui le contient entièrement, sinon il va sur la page.
- La couleur d’un nouveau trait se détache de ce sur quoi il est dessiné. Modifiez le contour du dernier trait dessiné, et les suivants reprennent ce style.
