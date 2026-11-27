---
pageClass: guide
title: Mise en page auto
description: Créez des cadres qui disposent leurs calques et s’adaptent à leur contenu.
---

# Mise en page auto

L’auto-layout permet à un cadre de disposer les calques qu’il contient. Modifiez un texte, ajoutez une ligne ou masquez un calque, et tout le reste se déplace pour s’ajuster. Utilisez-le pour les boutons, les listes, les cartes et des écrans entiers.

<GuidePair>

<GuideImage name="auto-layout/before" alt="Une carte de playlist avec deux chansons" caption="Deux chansons" />
<GuideImage name="auto-layout/after" alt="Une carte de playlist plus haute avec trois chansons" caption="Ajoutez-en une, et la carte s’agrandit" />

</GuidePair>

## Ajouter un auto-layout

1. Sélectionnez un cadre, ou les calques à disposer.
2. Appuyez sur <Keys mac="⇧ A" other="Shift A" />.

Le cadre se met à disposer ses calques. Les calques isolés sont placés dans un nouveau cadre. Appuyez de nouveau sur <Keys mac="⇧ A" other="Shift A" /> sur le cadre pour désactiver l’auto-layout.

## Configurer le cadre

Sélectionnez le cadre et repérez **Auto-layout** dans le panneau **Design**.

<GuideLegend>

<GuideImage name="auto-layout/panel" alt="Les réglages d’auto-layout avec six commandes numérotées" />

1. **Flux** dispose les calques librement, verticalement, horizontalement ou en grille.
2. **Retour à la ligne** fait passer les calques sur une nouvelle ligne quand la place manque.
3. **Redimensionnement** définit le comportement de la largeur et de la hauteur du cadre.
4. **Alignement** place les calques dans le cadre. Cliquez sur un point.
5. **Espacement** est l’espace entre les calques. Choisissez **Auto** dans son menu pour les répartir.
6. **Marges intérieures** est l’espace à l’intérieur des bords du cadre. Le bouton à côté permet de régler chaque côté séparément.

</GuideLegend>

## Modifier l’espacement sur le canevas

Sélectionnez le cadre et pointez un espacement ou un bord pour voir sa taille. Double-cliquez dessus, puis cliquez sur la valeur qui apparaît et saisissez-en une nouvelle.

## Choisir comment les calques se redimensionnent

Sélectionnez un calque, puis ouvrez le menu de son champ **W** ou **H**.

<GuideLegend>

<GuideImage name="auto-layout/sizing" alt="Le menu de largeur ouvert, avec Fixe, Ajuster au contenu et Remplir" />

- **Fixe** conserve la taille que vous avez définie.
- **Ajuster au contenu** s’adapte au contenu.
- **Remplir** occupe la place disponible dans le cadre parent.

</GuideLegend>

Pour une ligne de liste, essayez **Remplir** pour la largeur et **Ajuster au contenu** pour la hauteur. Le même menu permet d’ajouter des tailles minimale et maximale.

## Réordonner les calques

Faites glisser un calque vers un nouvel emplacement dans le cadre. La ligne bleue indique où il va se placer.

<GuidePair>

<GuideImage name="auto-layout/drag" alt="Le pointeur fait glisser Low Tide, avec une ligne bleue au-dessus de Paper Lanterns" caption="Faites glisser Low Tide vers le haut" />
<GuideImage name="auto-layout/drop" alt="Low Tide entre Slow Morning et Paper Lanterns" caption="Relâchez, et il prend sa place" />

</GuidePair>

## Renvoyer les calques à la ligne

Activez **Retour à la ligne** pour un contenu comme des étiquettes, dont le nombre varie. Un second champ d’espacement définit l’espace entre les lignes.

<GuideImage name="auto-layout/wrap" alt="Sept étiquettes réparties sur trois lignes" />

## Créer une grille

<GuideLegend>

<GuideImage name="auto-layout/grid-panel" alt="Les réglages de colonnes et de lignes d’une grille" />

1. Sélectionnez le cadre et choisissez **Grille** dans **Flux**.
2. Utilisez **+** à côté de **Colonnes** et **Lignes** pour ajouter des pistes.
3. Choisissez **Remplir (fr)** pour des pistes qui se partagent la place, ou **Fixe (px)** pour une taille définie.
4. Réglez les espacements entre colonnes et lignes en bas.

</GuideLegend>

<GuideImage name="auto-layout/grid" alt="Six pochettes d’album sur trois colonnes et deux lignes" />

## Placer un calque librement

Certains calques, comme un badge dans un coin, ne doivent pas être disposés avec les autres.

1. Sélectionnez le calque.
2. Cliquez sur **Ignorer la mise en page automatique** à côté de **Position**.
3. Faites-le glisser n’importe où dans le cadre.

Vous pouvez aussi maintenir <Keys mac="⌃" other="Ctrl" /> pendant le glissement. Le calque entre dans le cadre situé sous le pointeur.
