---
pageClass: guide
title: Dessiner des formes
description: Dessinez des rectangles, ellipses, lignes, polygones, étoiles, cadres et sections, puis colorez-les et ajoutez-leur des contours, des ombres et des flous.
---

# Dessiner des formes

Les outils de forme se trouvent dans la barre d’outils, en bas de la fenêtre. Choisissez-en un, puis faites glisser sur le canevas.

## Dessiner une forme

1. Appuyez sur <Keys mac="R" other="R" /> pour un rectangle, <Keys mac="O" other="O" /> pour une ellipse ou <Keys mac="L" other="L" /> pour une ligne. Les polygones et les étoiles se trouvent dans le menu des formes : cliquez sur la flèche à côté du rectangle.
2. Faites glisser sur le canevas. Maintenez <Keys mac="⇧" other="Shift" /> pour dessiner un carré ou un cercle, ou pour orienter une ligne par pas de 45°.
3. Relâchez. La nouvelle forme reste sélectionnée et la barre d’outils revient à **Déplacer**.

<GuideImage name="drawing-shapes/tools" alt="Le menu des formes ouvert dans la barre d’outils, avec Rectangle, Ligne, Ellipse, Polygone et Étoile" />

Un clic sans glisser crée une forme de 100 × 100, ou une ligne de 100 de long. Commencez à l’intérieur d’un cadre pour y dessiner la forme.

## Arrondir les coins

Survolez un rectangle sélectionné : un point apparaît à l’intérieur de chaque coin. Faites-en glisser un pour arrondir les coins : tous à la fois tant qu’ils sont égaux, ou seulement celui-ci s’ils diffèrent. Maintenez <Keys mac="⌥" other="Alt" /> pour faire l’inverse, et <Keys mac="⇧" other="Shift" /> pour avancer par pas de 10.

Pour saisir un rayon, utilisez **Rayon** dans le panneau **Design**. Le bouton à côté règle chaque coin séparément. **Lissage des coins** fait commencer la courbe plus tôt, comme sur une icône d’application.

Un polygone ou une étoile a un point de rayon, sous sa pointe du haut, et deux autres :

- Faites glisser le point situé sur la pointe suivante autour du centre pour changer le nombre de pointes.
- Faites glisser vers l’intérieur ou l’extérieur le point situé sur la première pointe intérieure d’une étoile pour l’affiner ou l’épaissir.

**Nombre** et **Rapport** dans le panneau **Design** font la même chose. Les points se masquent tant que la forme mesure moins d’environ 108 pixels à l’écran : zoomez pour les atteindre.

<GuidePair>

<GuideImage name="drawing-shapes/corners" alt="Un rectangle sélectionné avec un point à l’intérieur de chaque coin" caption="Points des coins d’un rectangle" />
<GuideImage name="drawing-shapes/star" alt="Une étoile sélectionnée avec des points pour son rayon, son nombre de pointes et son rapport" caption="Points de rayon, de pointes et de rapport d’une étoile" />

</GuidePair>

## Colorer une forme

Cliquez sur le carré de couleur sous **Remplissage**. Les boutons en haut du sélecteur, de gauche à droite, choisissent le type de remplissage :

<GuideLegend>

<GuideImage name="drawing-shapes/fill" alt="Le sélecteur de remplissage sur son bouton de dégradé, avec un dégradé linéaire violet et ses deux arrêts" />

- **Uni** : une seule couleur. Saisissez une valeur hexadécimale dans le panneau, ou utilisez la pipette pour prélever une couleur sur le canevas.
- **Dégradé** : linéaire, radial, angulaire ou diamant. Tant que le sélecteur est ouvert, le canevas affiche les poignées du dégradé. Faites glisser une extrémité pour la déplacer, avec <Keys mac="⇧" other="Shift" /> pour la faire pivoter par pas de 15°, et faites glisser le carré d’un arrêt pour le faire coulisser.
- **Image** : une image de votre ordinateur ou une [photo de stock](./photos). Elle peut remplir la forme avec **Fill**, **Fit**, **Crop** ou **Tile**, et les curseurs règlent l’exposition, le contraste et d’autres réglages.
- **Shader** : un effet animé, comme **Aurora**. Le canevas en affiche une image fixe, et il s’anime en aperçu : cliquez sur **▷** en haut à droite de la fenêtre, ou appuyez sur <Keys mac="⌘ ⌥ Enter" other="Ctrl Alt Enter" />. Cliquez sur **{ }** pour coller un preset copié depuis shaders.com.

</GuideLegend>

Cliquez sur **+** à côté de **Remplissage** pour ajouter un autre remplissage par-dessus. L’œil masque un remplissage, et **−** le supprime.

## Ajouter un contour

Cliquez sur **+** à côté de **Contour**. Ensuite :

- **Intérieur**, **Centré** ou **Extérieur** définit où se place la ligne par rapport au bord.
- **W** définit l’épaisseur. Le bouton à quatre carrés règle l’épaisseur de chaque côté séparément.
- Le bouton de réglages à côté active une ligne pointillée et définit l’aspect des extrémités et des angles de la ligne. Un tracé ouvert peut se terminer par une flèche.

## Ajouter des ombres et des flous

Cliquez sur **+** à côté de **Effets**, puis choisissez le type d’effet :

<GuideLegend>

<GuideImage name="drawing-shapes/effects" alt="La liste des effets : ombre portée, ombre interne, flou de calque, flou d’arrière-plan, flou de premier plan, bruit, texture et verre" />

- **Ombre portée** et **Ombre interne** : une ombre à l’extérieur ou à l’intérieur de la forme.
- **Flou de calque** floute la forme, **Flou d'arrière-plan** ce qui se trouve derrière elle, comme un verre dépoli, et **Flou de premier plan** ce qui se trouve devant. Un flou est **Uniforme**, ou **Progressif** pour passer du net au flou.
- **Bruit** et **Texture** : du grain sur la forme.
- **Verre** : courbe et éclaire ce qui se trouve derrière la forme, comme une lentille.

</GuideLegend>

Cliquez sur le carré à côté d’un effet pour modifier ses réglages. Une forme peut avoir plusieurs effets, mais un seul verre et une seule texture.

## Dessiner un cadre

Un cadre contient d’autres calques : un écran, une carte ou un bouton. Appuyez sur <Keys mac="F" other="F" /> ou <Keys mac="A" other="A" /> et faites glisser.

- Les calques entièrement recouverts par le nouveau cadre y entrent.
- Pour un cadre de la taille d’un écran de téléphone, de tablette ou d’ordinateur, choisissez une taille dans le panneau **Design** pendant que l’outil Cadre est actif. Lorsqu’un cadre est sélectionné, **Cadre** dans le panneau **Design** le redimensionne de la même façon.
- Un cadre masque ce qui dépasse. Désactivez **Rogner le contenu** pour l’afficher.
- Pour disposer le contenu d’un cadre en lignes ou en colonnes, utilisez l’[auto-layout](./auto-layout).

## Regrouper des zones avec des sections

Une section délimite une zone de la page, comme un parcours ou un ensemble d’écrans. Appuyez sur <Keys mac="⇧ S" other="Shift S" /> et faites glisser autour des calques.

Les calques entièrement recouverts par une section y entrent, y compris quand vous déplacez ou redimensionnez la section plus tard. Les sections restent au premier niveau de la page : elles ne peuvent pas entrer dans un cadre. Faites glisser le nom d’une section pour la déplacer.

## Organiser la barre d’outils

Faites un clic droit sur la barre d’outils et choisissez **Personnaliser la barre d’outils…**. Les mêmes réglages se trouvent dans **Paramètres → Éditeur**.

- Désactivez un outil pour le masquer. Son raccourci fonctionne toujours.
- Faites glisser un outil pour le déplacer. Déposez-le dans une boîte pour le placer dans ce menu, entre deux boîtes pour lui donner son propre bouton, ou sur un autre outil pour réunir les deux dans un même menu.
- **Rétablir les valeurs par défaut** remet tout en place.

Les outils ajoutés dans une version ultérieure prennent leur place habituelle, y compris dans une barre d’outils que vous avez modifiée.
