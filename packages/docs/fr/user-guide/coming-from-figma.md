---
pageClass: guide
title: Venir de Figma
description: Importez vos fichiers et calques Figma dans OpenPencil, et découvrez ce qui fonctionne de la même façon et ce qui diffère.
---

# Venir de Figma

OpenPencil lit et écrit les fichiers `.fig` de Figma et reprend les noms et les raccourcis de Figma : l’essentiel de ce que vous savez fonctionne donc ici. Vos fichiers restent les vôtres : ils s’ouvrent à nouveau dans Figma dès que vous en avez besoin.

## Importer vos fichiers

1. Dans Figma, ouvrez le fichier et choisissez **File → Save local copy…**.
2. Dans OpenPencil, ouvrez le fichier `.fig` ou faites-le glisser sur la fenêtre. Voir [Ouvrir et enregistrer](./files).

Enregistrer dans OpenPencil produit un fichier `.fig` qui s’ouvre aussi dans Figma.

## Copier des calques de l’un à l’autre

Sélectionnez des calques dans Figma, appuyez sur <Keys mac="⌘ C" other="Ctrl C" /> et collez-les dans OpenPencil avec <Keys mac="⌘ V" other="Ctrl V" />. Cela fonctionne aussi dans l’autre sens. Les remplissages, contours, effets, textes, l’auto-layout, les rayons d’angle et les tracés vectoriels sont conservés.

Les images des calques collés sont récupérées depuis Figma : vous devez donc pouvoir ouvrir le fichier Figma dont elles proviennent. <Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> et <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> copient et collent uniquement l’apparence d’un calque, y compris vers et depuis Figma.

## Ce qui fonctionne de la même façon

- **Cadres, groupes, sections et auto-layout**, avec les mêmes réglages, y compris la disposition en grille.
- **Composants, variantes et instances**, avec leurs propriétés et leurs emplacements (slots). Voir [Composants](./components).
- **Variables et modes**. Voir [Variables](./variables).
- **Les styles** de vos fichiers et bibliothèques s’appliquent comme dans Figma.
- **Les raccourcis** sont ceux de Figma, comme <Keys mac="R" other="R" /> pour un rectangle et <Keys mac="⇧ A" other="Shift A" /> pour l’auto-layout. Voir [Keyboard Shortcuts](/reference/keyboard-shortcuts).

## Ce qui fonctionne différemment

- **Bibliothèques.** Les bibliothèques d’équipe de Figma ne se connectent pas à OpenPencil. Pour partager des composants entre fichiers ici, [publiez une bibliothèque OpenPencil](./component-libraries).
- **Styles.** Vous pouvez appliquer et détacher des styles, mais pas encore en créer ni en modifier. Utilisez des [variables](./variables) pour les nouvelles couleurs et tailles.
- **Les modes de variables** se définissent sur un cadre ou une page dans **Apparence**, où chaque collection a toujours une ligne.
- **Polices.** L’app de bureau utilise les polices de votre ordinateur. Dans le navigateur, Chrome et Edge peuvent aussi les utiliser une fois que vous l’avez autorisé. Voir [Choisir une police](./text-editing#choisir-une-police).
- **Le prototypage** n’est pas encore disponible. Les composants peuvent [fonctionner comme des commandes](./components#faire-fonctionner-un-composant-comme-une-commande) en aperçu, par exemple un interrupteur qui bascule.
- **L’historique des versions** est réservé aux fichiers sur [OpenPencil Cloud](/cloud/).

La page [Compatibilité avec Figma](/fr/reference/figma-compatibility) liste chaque fonctionnalité de Figma et le niveau de prise en charge dans OpenPencil.

## À la place des plugins et du Dev Mode

- **Demandez à l’IA.** Une bonne partie de ce que font les plugins, comme renommer des calques, créer des variantes ou vérifier le contraste, le [chat IA](./ai-chat) le fait à partir d’une phrase. Il peut aussi utiliser un [agent de code](./coding-agents) que vous avez.
- **Écrivez un script.** Les scripts utilisent la même API que les plugins Figma, `figma.currentPage` et le reste. Voir [Scripts](/fr/developers/cli/scripting).
- **Récupérez le code.** L’onglet Code, à côté de Design, affiche la sélection en HTML, Vue ou React, avec CSS ou Tailwind.
- **Vérifiez les designs.** [Vérifier les designs](./checking-designs) repère les contrastes insuffisants, les cibles tactiles trop petites et les couleurs qui devraient utiliser une variable.
