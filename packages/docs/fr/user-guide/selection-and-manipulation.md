---
pageClass: guide
title: Sélection et manipulation
description: Sélectionnez des calques, puis déplacez-les, redimensionnez-les, faites-les pivoter, copiez-les et modifiez-en plusieurs à la fois.
---

# Sélection et manipulation

Pour modifier un calque, sélectionnez-le d’abord. Le panneau Design affiche alors ses réglages, et des poignées autour de lui vous permettent de le redimensionner et de le faire pivoter.

## Sélectionner un calque

Cliquez sur un calque sur le canevas. Dans un cadre, un clic sélectionne un calque situé juste à l’intérieur du cadre, comme une ligne d’une liste. Double-cliquez pour descendre d’un niveau.

<GuidePair>

<GuideImage name="selection-and-manipulation/click" alt="La ligne Paper Lanterns sélectionnée dans une carte de playlist" caption="Un clic sélectionne la ligne" />
<GuideImage name="selection-and-manipulation/double-click" alt="Le titre et l’artiste sélectionnés à l’intérieur de la ligne" caption="Un double-clic entre dans la ligne" />

</GuidePair>

Pour atteindre directement le calque sous le pointeur, maintenez <Keys mac="⌘" other="Ctrl" /> et cliquez. Pour ne rien sélectionner, cliquez sur une partie vide du canevas ou appuyez sur <Keys mac="Esc" other="Esc" />.

## Sélectionner plusieurs calques

- Maintenez <Keys mac="⇧" other="Shift" /> et cliquez sur des calques pour les ajouter à la sélection ou les en retirer.
- Faites glisser sur le canevas depuis un endroit vide pour tracer un rectangle de sélection. Les calques qu’il touche sont sélectionnés. Un cadre posé sur la page n’est sélectionné que si le rectangle le couvre entièrement.
- Appuyez sur <Keys mac="⌘ A" other="Ctrl A" /> pour tout sélectionner sur la page.

<GuideImage name="selection-and-manipulation/marquee" alt="Un rectangle de sélection tracé sur deux lignes d’une carte de playlist" />

## Sélectionner au clavier

- <Keys mac="Enter" other="Enter" /> sélectionne les calques contenus dans le calque sélectionné.
- <Keys mac="⇧ Enter" other="Shift Enter" /> sélectionne le calque qui le contient.
- <Keys mac="Tab" other="Tab" /> et <Keys mac="⇧ Tab" other="Shift Tab" /> sélectionnent le calque suivant et précédent au même niveau.

## Déplacer des calques

Faites glisser un calque sélectionné. Les touches fléchées le déplacent d’un pixel, et de dix avec <Keys mac="⇧" other="Shift" />.

- Maintenez <Keys mac="⇧" other="Shift" /> pendant le glissement pour vous déplacer en ligne droite.
- Relâchez au-dessus d’un cadre pour y placer le calque. Faites-le glisser hors du cadre pour l’en sortir.
- Maintenez <Keys mac="Space" other="Space" /> pendant le glissement pour garder le calque dans son cadre.

## Redimensionner et faire pivoter

<GuideLegend>

<GuideImage name="selection-and-manipulation/handles" alt="Une carte sélectionnée avec trois parties numérotées : une poignée d’angle, la poignée de rotation et la taille" />

1. Faites glisser une **poignée** pour redimensionner. Maintenez <Keys mac="⇧" other="Shift" /> sur un angle pour conserver les proportions.
2. Faites glisser la **poignée de rotation** pour faire pivoter, ou pointez juste à l’extérieur d’un angle et faites glisser. Maintenez <Keys mac="⇧" other="Shift" /> pour tourner par pas de 15°.
3. La **taille** s’affiche tant que le calque est sélectionné.

</GuideLegend>

Pour saisir une taille ou un angle exacts, utilisez **W**, **H** et le champ d’angle dans le panneau Design. <Keys mac="⇧ H" other="Shift H" /> et <Keys mac="⇧ V" other="Shift V" /> retournent la sélection horizontalement ou verticalement.

## Copier, coller et supprimer

- <Keys mac="⌘ D" other="Ctrl D" /> crée une copie à côté de l’original.
- Maintenez <Keys mac="⌥" other="Alt" /> pendant le glissement pour faire sortir une copie.
- <Keys mac="⌘ C" other="Ctrl C" /> et <Keys mac="⌘ V" other="Ctrl V" /> copient et collent. Un calque collé garde sa position ; pour coller sous le pointeur, faites un clic droit et choisissez **Coller ici**.
- <Keys mac="⇧ ⌘ R" other="Ctrl Shift R" /> colle à la place des calques sélectionnés.
- <Keys mac="⌫" other="Delete" /> supprime la sélection.

Le texte copié depuis une page web est collé comme un seul calque de texte. Lorsque vous copiez une partie de la mise en page d’une page, comme une carte, une notification propose **Coller en tant que calques** pour la reconstruire en cadres et en texte.

## Copier l’apparence d’un calque

<Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> copie l’apparence d’un calque, et <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> applique cette apparence à chaque calque sélectionné. Cela fonctionne aussi avec des calques copiés dans Figma.

L’apparence comprend les remplissages, les contours, les effets, l’opacité, le mode de fusion, le rayon des angles, ainsi que les styles et les variables qu’ils utilisent. Entre cadres, elle inclut l’auto-layout, et entre calques de texte, le style de texte. La position, la taille, le nom et le contenu restent inchangés.

## Grouper des calques

- <Keys mac="⌘ G" other="Ctrl G" /> groupe la sélection.
- <Keys mac="⌥ ⌘ G" other="Ctrl Alt G" /> la place plutôt dans un nouveau cadre.
- <Keys mac="⇧ ⌘ G" other="Ctrl Shift G" /> défait un groupe, un cadre ou une section, et laisse ses calques là où ils sont.

Pour disposer des calques en ligne ou en colonne, utilisez plutôt l’[auto-layout](./auto-layout).

## Afficher un calque à travers une forme

Placez la forme sous les calques qu’elle doit découper, sélectionnez-les tous et appuyez sur <Keys mac="⌥ ⌘ M" other="Ctrl Alt M" />. Le calque du bas devient un masque : les calques au-dessus ne s’affichent qu’à l’intérieur, comme une photo dans un cercle. Appuyez à nouveau pour désactiver le masque.

## Placer des calques devant ou derrière

Les calques placés plus haut dans la [liste des calques](./layers-and-pages) recouvrent ceux du dessous.

- <Keys mac="]" other="]" /> met la sélection au premier plan, et <Keys mac="[" other="[" /> la met à l’arrière-plan.
- <Keys mac="⌘ ]" other="Ctrl ]" /> et <Keys mac="⌘ [" other="Ctrl [" /> la déplacent d’un cran.

## Masquer et verrouiller des calques

- <Keys mac="⇧ ⌘ H" other="Ctrl Shift H" /> masque la sélection, ou l’affiche à nouveau. Les calques masqués restent dans la liste des calques.
- <Keys mac="⇧ ⌘ L" other="Ctrl Shift L" /> la verrouille. Vous ne pouvez pas sélectionner ni déplacer un calque verrouillé sur le canevas ; sélectionnez-le plutôt dans la liste des calques.

## Modifier plusieurs calques à la fois

Lorsque plusieurs calques sont sélectionnés, le panneau Design affiche les réglages qu’ils ont en commun. **Mixte** signale un réglage qui diffère entre eux. Modifiez un réglage, et il change pour tous.

<GuideImage name="selection-and-manipulation/several" alt="Le panneau Design pour deux lignes sélectionnées, avec Y sur Mixte" />

<GuideLegend>

<GuideImage name="selection-and-manipulation/selection-colors" alt="Couleurs de la sélection listant quatre couleurs" />

**Couleurs de la sélection** liste toutes les couleurs de la sélection, y compris celles des calques qu’elle contient. Modifiez une couleur ici pour la changer partout où elle est utilisée.

</GuideLegend>
