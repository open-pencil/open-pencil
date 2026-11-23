---
title: OpenPencil vs Pencil
description: Ce qui distingue OpenPencil, un éditeur de design open source, et Pencil (pen.dev), un outil de design IA propriétaire, sur la licence, les formats de fichier, l’IA, la collaboration et le prix.
---

# OpenPencil vs Pencil

[Pencil](https://pen.dev) est un outil de design IA commercial qui conserve les designs dans des fichiers `.pen` et travaille aux côtés des agents de code. OpenPencil est un éditeur de design open source qui ouvre ces fichiers `.pen` ainsi que les fichiers `.fig` de Figma. Ce sont deux projets distincts, menés par des équipes différentes. Cette page compare Pencil desktop 1.2 et OpenPencil 0.17.

## En bref

|                        | OpenPencil                                                                                                         | Pencil                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Licence                | Open source : MIT (éditeur), Apache 2.0 (serveur Cloud)                                                            | Propriétaire                                                                                    |
| Prix                   | Gratuit ; les offres Cloud ajoutent stockage, éditeurs et crédits IA                                               | Offre gratuite avec IA limitée ; offres Pro et Ultra par utilisateur                            |
| Plateformes            | Application de bureau pour macOS, Windows et Linux, et navigateur                                                  | Application de bureau, extension d’éditeur de code et navigateur                                |
| Format natif           | Figma `.fig`                                                                                                       | `.pen`                                                                                          |
| Ouvre les `.pen`       | Oui                                                                                                                | Oui                                                                                             |
| Ouvre les `.fig`       | Les ouvre et les enregistre                                                                                        | Les importe                                                                                     |
| IA intégrée            | Assistant de chat avec plus de 100 outils de design ; vos propres clés de fournisseur ou des crédits Cloud         | Agents sur le canevas ; vos propres clés, un abonnement ChatGPT ou Claude, ou des offres        |
| Agents de code         | Serveur MCP, plus Claude Code, Codex, Cursor et d’autres exécutés dans l’éditeur                                   | Serveur MCP pour Claude Code, Codex, Cursor et d’autres                                         |
| Scripts                | CLI headless et scripts compatibles avec la Figma Plugin API                                                       | CLI                                                                                             |
| Export de code         | Design JSX, HTML, Vue et React avec CSS ou Tailwind                                                                | HTML avec CSS ou Tailwind                                                                       |
| Collaboration          | Édition en temps réel dans des salles pair-à-pair ou sur OpenPencil Cloud, avec commentaires et historique         | Liens de partage, partages en direct, commentaires et versions                                  |
| Auto-hébergement       | Serveur OpenPencil Cloud                                                                                           | —                                                                                               |

## Licence et fichiers

Pencil est concédé sous licence, pas vendu : ses conditions interdisent de modifier ou de redistribuer l’application. L’éditeur d’OpenPencil est sous licence MIT et son serveur Cloud sous Apache 2.0, vous pouvez donc tout lire, modifier et héberger.

OpenPencil enregistre au format `.fig` de Figma, que Figma et d’autres outils ouvrent aussi. Il ouvre les documents `.pen`, ce qui permet de reprendre un projet Pencil et de l’enregistrer en `.fig` ; voir [Exporter](/fr/user-guide/exporting) pour l’ouverture des fichiers.

## IA

Les deux éditeurs sont conçus pour travailler avec l’IA. Pencil exécute plusieurs agents à la fois sur le canevas, génère des images et des SVG, et décompte l’usage de l’IA des limites de l’offre, sauf si vous apportez votre propre clé ou abonnement.

L’[assistant IA](/fr/user-guide/ai-chat) d’OpenPencil fonctionne avec votre propre clé pour Anthropic, OpenAI, Google AI, OpenRouter et d’autres fournisseurs, sans limite d’usage de notre part, ou avec les crédits inclus dans une offre Cloud. Les mêmes 100+ outils sont ouverts aux agents de code via le [serveur MCP](/developers/mcp-server), et l’application de bureau exécute des [agents de code](/user-guide/coding-agents) comme Claude Code et Codex dans l’éditeur, chacun avec son propre curseur sur le canevas.

## Collaboration

OpenPencil permet d’éditer à plusieurs en temps réel : ouvrez une [salle pair-à-pair](/fr/user-guide/collaboration) sans serveur ni compte, ou gardez les documents sur [OpenPencil Cloud](/cloud/), hébergé ou sur votre propre serveur, avec partage, commentaires et historique des versions. Pencil partage les designs par lien et partage en direct, avec commentaires et versions, sur son propre service.

## Là où Pencil a l’avantage

- **Agents en parallèle.** Pencil exécute jusqu’à six agents sur un même canevas avec son offre la plus élevée.
- **Images générées.** Pencil génère des images et des SVG et supprime les arrière-plans ; OpenPencil vectorise les images via Recraft ou fal.ai mais ne les génère pas.
- **Extension d’éditeur de code.** Pencil fonctionne dans VS Code et Cursor ; OpenPencil fonctionne à côté.

## Lequel choisir

Choisissez OpenPencil si vous voulez un éditeur open source que vous pouvez héberger vous-même, des fichiers dans un format que Figma ouvre aussi, et une IA sur vos propres clés sans limites d’offre. Choisissez Pencil si vous voulez plusieurs agents qui designent en même temps dans votre éditeur de code.
