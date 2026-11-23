---
title: OpenPencil vs Lunacy
description: Ce qui distingue OpenPencil et Lunacy, deux éditeurs de design de bureau gratuits qui ouvrent les fichiers Figma, sur la licence, l’enregistrement vers Figma, l’IA et l’automatisation, et l’auto-hébergement.
---

# OpenPencil vs Lunacy

[Lunacy](https://icons8.com/lunacy) d’Icons8 et OpenPencil sont deux éditeurs de design gratuits avec des applications de bureau natives pour macOS, Windows et Linux, et tous deux ouvrent les fichiers `.fig` de Figma. Ils diffèrent par qui contrôle le logiciel et par où va votre travail ensuite. Cette page compare Lunacy 14 et OpenPencil 0.17.

## En bref

|                       | OpenPencil                                                                                                       | Lunacy                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Licence               | Open source : MIT (éditeur), Apache 2.0 (serveur Cloud)                                                          | Gratuiciel propriétaire                                                                        |
| Prix                  | Gratuit ; les offres Cloud ajoutent stockage, éditeurs et crédits IA                                             | Gratuit ; offres payantes pour les fonctions cloud et d’équipe et les graphismes sans attribution |
| Plateformes           | Application de bureau pour macOS, Windows et Linux, et navigateur                                                | Application de bureau pour macOS, Windows et Linux, et navigateur                              |
| Format natif          | Figma `.fig`                                                                                                     | `.free` et Sketch `.sketch`                                                                    |
| Fichiers `.fig`       | Les ouvre et les enregistre ; copier-coller avec Figma dans les deux sens                                        | Les ouvre                                                                                      |
| Hors ligne            | Oui                                                                                                              | Oui, avec des documents locaux                                                                 |
| Collaboration         | Salles pair-à-pair, ou OpenPencil Cloud avec commentaires et historique des versions                             | Cloud de Lunacy ou cloud privé, avec commentaires                                              |
| Auto-hébergement      | Serveur OpenPencil Cloud                                                                                         | Cloud privé sur vos propres serveurs, avec une licence payante                                 |
| IA intégrée           | Assistant de chat avec plus de 100 outils de design ; vos propres clés de fournisseur ou des crédits Cloud       | Chat IA sur le service d’Icons8, plus des outils d’image                                       |
| Agents de code        | Serveur MCP, plus Claude Code, Codex, Cursor et d’autres exécutés dans l’éditeur                                 | Serveur MCP                                                                                    |
| Scripts               | CLI headless et scripts compatibles avec la Figma Plugin API                                                     | Plugins via son API MCP                                                                        |
| Export de code        | Design JSX, HTML, Vue et React avec CSS ou Tailwind                                                              | Inspection CSS                                                                                 |
| Prototypage           | Comportements de composants en direct ; flux et transitions sont sur la [feuille de route](/development/roadmap) | Flux, smart animate et animations à ressort                                                    |
| Ressources intégrées  | Jeux d’icônes                                                                                                    | Icônes, photos, illustrations et kits d’interface d’Icons8                                     |

## Travailler avec les fichiers Figma

Lunacy ouvre les fichiers `.fig` et enregistre dans son propre format `.free` ou en fichiers Sketch : un design qui quitte Figma pour Lunacy n’y revient pas en `.fig`. OpenPencil enregistre lui-même en `.fig` : vous pouvez ouvrir un fichier d’un collègue sur Figma, le modifier et le renvoyer, et copier-coller des calques entre les deux applications dans les deux sens. Un fichier complexe peut tout de même s’afficher différemment une fois rouvert dans Figma : gardez l’original jusqu’à avoir vérifié le résultat ; voir [Compatibilité Figma](/fr/reference/figma-compatibility).

## Open source et hébergement

Lunacy est gratuit mais propriétaire, et faire tourner son cloud privé sur vos propres serveurs exige une licence payante. Le code d’OpenPencil est ouvert, et les documents peuvent rester sur votre appareil, dans votre propre [bucket de stockage](/user-guide/cloud-storage) ou sur [OpenPencil Cloud](/cloud/), y compris sur un [serveur géré par votre équipe](/cloud/self-hosting/).

## IA et automatisation

Le chat IA de Lunacy fonctionne sur le service d’Icons8 sans clé d’API. L’[assistant IA](/fr/user-guide/ai-chat) d’OpenPencil utilise votre propre clé de fournisseur ou des crédits Cloud, et les mêmes 100+ outils sont ouverts aux agents de code via le [serveur MCP](/developers/mcp-server). La [CLI](/fr/developers/cli/inspecting) inspecte, analyse et exporte des documents sans ouvrir l’éditeur, et [`eval`](/fr/developers/cli/scripting) exécute des scripts écrits pour la Figma Plugin API.

## Là où Lunacy a l’avantage

- **Prototypage.** Lunacy offre flux, smart animate et animations à ressort ; OpenPencil n’a pas encore de flux de prototype.
- **Graphismes intégrés.** Lunacy inclut les icônes, photos, illustrations et kits d’interface d’Icons8.
- **Maturité.** Lunacy est développé depuis des années et a atteint la version 14.

## Lequel choisir

Choisissez OpenPencil si vous devez continuer à échanger des fichiers `.fig` avec les utilisateurs de Figma, si vous voulez un logiciel et un hébergement que vous contrôlez, ou si vous voulez que des agents de code et des scripts travaillent sur vos designs. Choisissez Lunacy si vous voulez du prototypage et une grande bibliothèque graphique intégrée dans une application gratuite.
