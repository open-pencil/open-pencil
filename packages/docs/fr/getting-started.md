---
pageClass: guide
title: Premiers pas
description: Ouvrez OpenPencil dans votre navigateur ou sur votre ordinateur, repérez-vous dans l’interface et réalisez un premier design.
---

# Premiers pas

OpenPencil est un éditeur de design pour les écrans, d’un simple bouton à une application entière. Il ouvre et enregistre les fichiers Figma, et fonctionne dans votre navigateur ou en tant qu’application de bureau.

## Ouvrir OpenPencil

- **Dans votre navigateur :** rendez-vous sur [cloud.openpencil.dev](https://cloud.openpencil.dev). Il n’y a rien à installer.
- **Sur votre ordinateur :** téléchargez l’application pour macOS, Windows ou Linux depuis la [page de téléchargement](/fr/download). Sur Mac, vous pouvez aussi l’installer avec Homebrew : `brew install --cask openpencil`.

::: tip Déménagé depuis app.openpencil.dev
L’application web a déménagé sur cloud.openpencil.dev. Les fichiers que vous avez gardés dans votre navigateur sur [app.openpencil.dev](https://app.openpencil.dev) y restent jusqu’à ce que cette adresse commence à rediriger : ouvrez-la pour les enregistrer dans le Cloud ou les télécharger.
:::

## Configuration requise

Dans un navigateur, OpenPencil nécessite Chrome ou Edge 111, Firefox 128 ou Safari 16.4, ou une version plus récente. Les navigateurs basés sur Chrome, comme Brave et Opera, fonctionnent à partir des mêmes versions.

L’application de bureau nécessite :

- **macOS** 13 Ventura ou version ultérieure, avec ses mises à jour de Safari installées.
- **Windows** 10 ou version ultérieure, avec le runtime Microsoft Edge WebView2, que Windows tient à jour.
- **Linux** avec WebKitGTK 2.40 ou version ultérieure (`webkit2gtk-4.1`).

Si votre navigateur ou votre système est trop ancien, OpenPencil indique ce qu’il faut mettre à jour. Si ce message apparaît sur un système qui remplit ces conditions, cliquez sur **Signaler un problème** dans le message.

## Se repérer

<GuideImage name="getting-started/editor" alt="L’éditeur avec huit zones numérotées" />

1. **Menus.** Fichier, Édition, Affichage et les autres, sous le nom du fichier.
2. **Pages.** Chaque page est un canevas distinct dans le même fichier.
3. **Calques.** Tout ce qui se trouve sur la page, dans l’ordre où c’est dessiné.
4. **Canevas.** L’endroit où vous concevez.
5. **Barre d’outils.** Les outils pour les cadres, les formes, la plume et le texte.
6. **Panneau Design.** Les réglages de ce que vous avez sélectionné. Les onglets à côté de **Design** l’affichent sous forme de code, ouvrent le chat IA et vérifient votre design à la recherche de problèmes.
7. **Zoom.** Cliquez sur le pourcentage pour afficher les options de zoom.
8. **Partager et Aperçu.** Invitez des personnes sur le fichier, ou essayez votre design comme un prototype.

## Réaliser un premier design

1. Appuyez sur <Keys mac="F" other="F" /> et faites glisser sur le canevas pour dessiner un cadre. Les cadres contiennent le reste de votre design, comme un écran ou une carte.
2. Appuyez sur <Keys mac="R" other="R" /> et faites glisser à l’intérieur du cadre pour dessiner un rectangle.
3. Appuyez sur <Keys mac="T" other="T" />, cliquez dans le cadre et tapez du texte.
4. Appuyez sur <Keys mac="Esc" other="Esc" /> pour terminer la saisie. Le panneau Design affiche maintenant la police et la taille du texte.
5. Appuyez sur <Keys mac="⌘ S" other="Ctrl S" /> pour enregistrer.

[Ouvrir et enregistrer](./user-guide/files) explique où va votre fichier.

## Trouver une commande

Appuyez sur <Keys mac="⌘ K" other="Ctrl K" /> et tapez ce que vous voulez faire, par exemple « aligner à gauche » ou « exporter ». Choisissez un résultat pour l’exécuter. Vous pouvez aussi taper le nom d’une page pour y aller.

## Utiliser un téléphone ou une tablette

Sur un petit écran, les panneaux passent dans un tiroir en bas de l’écran. Ses boutons ouvrent les calques, le panneau Design, le code et le chat IA.

## Étapes suivantes

- [Navigation sur le canevas](./user-guide/canvas-navigation) : se déplacer et zoomer.
- [Sélection et manipulation](./user-guide/selection-and-manipulation) : sélectionner, déplacer et redimensionner des calques.
- [Calques et pages](./user-guide/layers-and-pages) : organiser le contenu de votre fichier.
- [Mise en page auto](./user-guide/auto-layout) : créer des cadres qui se redimensionnent avec leur contenu.

Vous voulez compiler OpenPencil vous-même ? Consultez [Contributing](/development/contributing#build-from-source).
