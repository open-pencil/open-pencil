---
pageClass: guide
title: Édition de texte
description: Ajoutez du texte, mettez en forme tout le texte ou quelques mots, créez des listes, dimensionnez la zone de texte et choisissez des polices.
---

# Édition de texte

Le texte se saisit et se met en forme directement sur le canevas. La section **Typographie** du panneau **Design** regroupe ses réglages.

## Ajouter du texte

Appuyez sur <Keys mac="T" other="T" />, puis :

- Cliquez et tapez. La zone de texte s’agrandit à mesure que vous tapez.
- Ou tracez d’abord une zone. Le texte revient à la ligne dans sa largeur.

Pour terminer, appuyez sur <Keys mac="Esc" other="Esc" /> ou cliquez en dehors du texte.

## Modifier du texte

Double-cliquez sur un texte pour le modifier, ou sélectionnez-le et appuyez sur <Keys mac="Enter" other="Enter" />. Tout son texte est sélectionné : vous pouvez taper directement par-dessus.

Pendant l’édition :

- Cliquez pour placer le curseur, ou faites glisser pour sélectionner.
- Un double-clic sélectionne un mot, un triple-clic tout le texte.
- Les touches de texte habituelles fonctionnent, comme <Keys mac="⌥ ←" other="Ctrl ←" /> pour avancer mot par mot et <Keys mac="⇧" other="Shift" /> avec une flèche pour sélectionner.

## Mettre en forme le texte

Sélectionnez un calque de texte pour mettre en forme tout son texte, ou sélectionnez quelques caractères pendant l’édition pour ne mettre en forme que ceux-ci.

<GuideLegend>

<GuideImage name="text-editing/typography" alt="La section Typographie du panneau Design avec cinq parties numérotées : police, graisse et taille, espacement, alignement et mise en forme" />

1. **Famille de police**. L’engrenage à côté ouvre les réglages des polices.
2. **Graisse** et **Taille de police**.
3. **Hauteur de ligne** et **Espacement des lettres**.
4. **Alignement du texte**, horizontal et vertical.
5. **Gras**, **Italique**, **Souligné** et **Barré**. Le gras, l’italique et le soulignement ont aussi des raccourcis : <Keys mac="⌘ B" other="Ctrl B" />, <Keys mac="⌘ I" other="Ctrl I" /> et <Keys mac="⌘ U" other="Ctrl U" />.

</GuideLegend>

En dessous, **Casse du texte** affiche le texte en majuscules ou en minuscules sans avoir à le retaper. Le texte saisi à côté de caractères mis en forme reprend leur style.

## Créer une liste

Sous **Listes et paragraphes**, choisissez une liste à puces ou numérotée pour les lignes sélectionnées. Les champs en dessous règlent l’espace entre les éléments de liste, l’espace entre les paragraphes et le retrait de la première ligne d’un paragraphe. **Listes en retrait négatif** place les puces et les numéros en dehors du bord du texte, pour que les lignes de texte restent alignées.

## Dimensionner la zone de texte

Les boutons sous **Redimensionnement**, dans la section **Disposition**, choisissent comment la zone suit son texte :

- **Largeur automatique** : la zone s’élargit et le texte reste sur une seule ligne, sauf si vous appuyez sur <Keys mac="Enter" other="Enter" />.
- **Hauteur automatique** : la largeur reste fixe et le texte revient à la ligne, tandis que la zone s’agrandit vers le bas.
- **Fixe** : la zone garde sa taille. Réglez **Troncature** sur **Points de suspension finaux** pour terminer le texte par « … » là où il ne tient plus, ou après un certain nombre de lignes.

## Choisir une police

Cliquez sur le nom de la police dans **Typographie**, puis tapez pour chercher. Chaque police de la liste s’affiche dans son propre caractère, avec sa provenance.

Les polices disponibles dépendent de l’endroit où vous utilisez OpenPencil :

- **Application de bureau** : les polices de votre ordinateur, et celles de Google Fonts, Fontsource, Bunny Fonts et Fontshare. Les polices téléchargées sont conservées pour la prochaine fois.
- **Navigateur** : Fontsource, Bunny Fonts et Fontshare. Chrome et Edge affichent aussi les polices de votre ordinateur une fois que vous l’avez autorisé.

Choisissez les sources dans **Paramètres → Polices**, que l’engrenage à côté du nom de la police ouvre. Inter est toujours disponible.

## Affiner une police variable

Une police variable, comme Inter, peut être dessinée avec n’importe quelle graisse, largeur ou autre réglage qu’elle prend en charge. **Typographie** liste ces réglages avec leurs valeurs : saisissez ou faites glisser une valeur pour la changer. Choisir une graisse ou une autre police les réinitialise.

**Optical size** indique **Auto** tant qu’il suit la taille de police. Saisissez une valeur, ou choisissez **Fixe** dans son menu, pour le garder identique quelle que soit la taille.

## Quand une police manque

Quand un fichier utilise une police qu’OpenPencil ne peut pas charger, une note s’affiche au-dessus du canevas. Ouvrez-la pour voir quelles polices manquent et ce qui s’affiche à leur place.

- **Sélectionner les calques** sélectionne le texte qui les utilise.
- **Réessayer les polices** fait une nouvelle tentative, par exemple après que vous avez autorisé l’accès aux polices de votre ordinateur ou activé une autre source.

Un style manquant, comme Bold, peut être dessiné à partir d’un autre style de la même police. Une police manquante s’affiche en Inter.

## Texte sur un tracé

Un texte qui suit une courbe dans un fichier Figma garde sa forme ici. Vous pouvez modifier son texte et son style, mais pas encore placer un nouveau texte sur un tracé.
