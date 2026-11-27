---
pageClass: guide
title: Venir de pen.dev
description: Ouvrez les fichiers pen.dev (anciennement Pencil) dans OpenPencil, voyez ce qui est repris et continuez à concevoir avec un agent IA.
---

# Venir de pen.dev

OpenPencil ouvre les fichiers `.pen` de pen.dev, anciennement appelé Pencil. Votre design arrive sous forme de calques modifiables, et vous continuez à travailler avec l’agent IA que vous utilisez déjà.

## Ouvrir un fichier `.pen`

Appuyez sur <Keys mac="⌘ O" other="Ctrl O" /> et choisissez le fichier, ou faites-le glisser sur la fenêtre. Sur votre ordinateur, vous pouvez aussi l’ouvrir depuis le Finder ou l’Explorateur de fichiers avec l’app de bureau.

OpenPencil lit les fichiers `.pen` mais ne les écrit pas. Au premier enregistrement, il vous demande où placer un nouveau fichier `.fig`, nommé comme l’original ; un navigateur sans boîte de dialogue d’enregistrement le télécharge à la place. Le fichier `.pen` reste tel quel, et le fichier `.fig` s’ouvre aussi dans Figma.

## Ce qui est repris

- Les cadres, formes et tracés, avec leurs remplissages, contours et effets.
- Le texte et la mise en page : lignes, colonnes, espacements et marges intérieures.
- Les composants et leurs instances, avec les modifications apportées à chaque instance.
- Les thèmes, sous forme de collections de [variables](./variables). Les options de thème que vos variables combinent, comme le mode de couleur et la densité, partagent une collection dont les modes sont leurs combinaisons ; une option isolée a sa propre collection.
- Les icônes et les images.

Certains éléments ne sont pas encore repris :

- Les calques provenant d’autres fichiers que le document importe.
- Les calques de script, de navigateur, de shader, de note et de contexte.
- Dans le navigateur, les images enregistrées à côté du fichier. Ouvrez le fichier dans l’app de bureau pour les conserver.

## Continuer avec un agent IA

L’agent avec lequel vous concevez dans pen.dev peut aussi travailler dans OpenPencil :

- Dans l’app de bureau, utilisez comme chat IA [Claude Code, Codex, Cursor ou un autre agent de code](./coding-agents) que vous avez déjà.
- Ou connectez votre agent au [serveur MCP](/developers/mcp-server) d’OpenPencil depuis son propre terminal ou éditeur : il modifie alors le document ouvert.

Les agents modifient le document pendant qu’il est ouvert : ils n’ont donc pas besoin d’un fichier `.pen` sur le disque.
