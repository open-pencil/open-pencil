---
title: OpenPencil vs Paper
description: Ce qui distingue OpenPencil, un éditeur de design open source, et Paper, un canevas de design commercial bâti sur HTML et CSS, sur les fichiers Figma, l’usage local, les agents IA et le prix.
---

# OpenPencil vs Paper

[Paper](https://paper.design) est un outil de design commercial dont le canevas est bâti sur HTML et CSS, conçu pour travailler avec des agents de code IA via MCP. OpenPencil est un éditeur de design open source qui ouvre les fichiers `.fig` de Figma, dispose de son propre assistant IA et donne aussi aux agents un jeu d’outils complet. Cette page compare Paper Desktop 0.5 et OpenPencil 0.17.

## En bref

|                          | OpenPencil                                                                                                   | Paper                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Licence                  | Open source : MIT (éditeur), Apache 2.0 (serveur Cloud)                                                      | Propriétaire                                                                           |
| Prix                     | Gratuit ; les offres Cloud ajoutent stockage, éditeurs et crédits IA                                         | Offre gratuite avec 100 appels MCP par semaine ; Pro par éditeur                       |
| Plateformes              | Application de bureau pour macOS, Windows et Linux, et navigateur                                            | Application de bureau pour macOS, Windows et Linux, et navigateur                      |
| Emplacement des fichiers | Sur votre appareil, dans votre propre bucket de stockage ou sur OpenPencil Cloud                             | Service de Paper                                                                       |
| Auto-hébergement         | Serveur OpenPencil Cloud                                                                                     | —                                                                                      |
| Figma                    | Ouvre et enregistre les fichiers `.fig` ; copier-coller dans les deux sens                                   | Collage depuis Figma                                                                   |
| IA intégrée              | Assistant de chat avec plus de 100 outils de design ; vos propres clés de fournisseur ou des crédits Cloud   | Génération d’images et de SVG ; travail de design via des agents externes              |
| Agents de code           | Serveur MCP, plus Claude Code, Codex, Cursor et d’autres exécutés dans l’éditeur                             | Serveurs MCP local et distant                                                          |
| Scripts                  | CLI headless et scripts compatibles avec la Figma Plugin API                                                 | CLI pour son serveur MCP                                                               |
| Export de code           | Design JSX, HTML, Vue et React avec CSS ou Tailwind                                                          | React avec CSS ou Tailwind                                                             |
| Export                   | PNG, JPG, WEBP, SVG et `.fig` ; PDF depuis la CLI                                                            | PNG, SVG, PDF et vidéo                                                                 |
| Collaboration            | Salles pair-à-pair ou OpenPencil Cloud, avec commentaires et historique des versions                         | Édition en temps réel avec coéquipiers et agents, et commentaires                      |

## Fichiers et hébergement

Paper conserve les designs sur son propre service. OpenPencil enregistre des fichiers `.fig` ordinaires que Figma ouvre aussi, et vous laisse les garder sur votre appareil, dans votre propre [bucket de stockage](/user-guide/cloud-storage) ou sur [OpenPencil Cloud](/cloud/), hébergé ou sur un [serveur géré par votre équipe](/cloud/self-hosting/). Il ouvre directement les fichiers Figma, là où Paper reprend des calques collés depuis Figma.

## IA et agents

Les deux sont conçus pour les agents. Paper n’a pas d’assistant intégré : vous designez avec lui via un agent externe comme Claude Code ou Cursor sur son serveur MCP, et son offre gratuite autorise 100 appels MCP par semaine.

OpenPencil dispose d’un [assistant IA](/fr/user-guide/ai-chat) dans l’éditeur, avec votre propre clé de fournisseur ou des crédits Cloud, et les mêmes 100+ outils sont ouverts aux agents externes via le [serveur MCP](/developers/mcp-server) sans limite d’appels. L’application de bureau peut aussi exécuter des [agents de code](/user-guide/coding-agents) dans l’éditeur, chacun avec son propre curseur sur le canevas. La [CLI](/fr/developers/cli/inspecting) et [`eval`](/fr/developers/cli/scripting) travaillent sur les documents sans ouvrir l’éditeur du tout.

## Là où Paper a l’avantage

- **Canevas HTML et CSS.** Les calques de Paper sont de la mise en page web, donc ce que vous concevez est ce qu’un navigateur affiche. OpenPencil met en page avec flexbox et CSS Grid via Taffy et exporte du HTML, mais son canevas n’est pas une page web.
- **Médias générés.** Paper génère des images et des SVG et exporte de la vidéo.
- **MCP distant.** Le serveur MCP hébergé de Paper fonctionne même quand l’application est fermée.

## Lequel choisir

Choisissez OpenPencil si vous voulez un éditeur open source, des fichiers `.fig` que vous gardez, une IA intégrée en plus des agents, ou aucune limite d’appels pour les agents. Choisissez Paper si vous voulez un canevas entièrement en HTML et CSS.
