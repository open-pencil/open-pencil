---
title: OpenPencil vs Penpot
description: Ce qui distingue OpenPencil et Penpot, deux outils de design open source, sur la prise en charge des fichiers Figma, l’IA et l’automatisation, la collaboration, l’auto-hébergement et l’application de bureau.
---

# OpenPencil vs Penpot

OpenPencil et Penpot sont deux outils de design open source utilisables à la place de Figma. Ils partent de points différents : Penpot est une plateforme web bâtie autour de son propre format de fichier et d’un serveur d’équipe, tandis qu’OpenPencil est un éditeur qui ouvre vos fichiers Figma existants, fonctionne sur votre appareil et peut être piloté par vous, par des scripts ou par des agents IA. Cette page compare Penpot 2.16 et OpenPencil 0.17.

## En bref

|                       | OpenPencil                                                                                                       | Penpot                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Licence               | MIT (éditeur), Apache 2.0 (serveur Cloud)                                                                        | MPL 2.0                                               |
| Fichiers Figma `.fig` | Les ouvre et les enregistre ; copier-coller avec Figma dans les deux sens                                        | Ne les ouvre pas                                      |
| Plateformes           | Application de bureau pour macOS, Windows et Linux, et navigateur                                                | Navigateur                                            |
| Hors ligne            | Oui ; les documents peuvent rester sur votre appareil                                                            | Nécessite son serveur                                 |
| Comptes               | Inutiles pour éditer ; facultatifs pour Cloud                                                                    | Obligatoires                                          |
| Collaboration         | Salles pair-à-pair sans serveur, ou OpenPencil Cloud avec partage, commentaires et historique                    | Sur serveur, avec partage, commentaires et historique |
| Auto-hébergement      | Serveur OpenPencil Cloud                                                                                         | Déploiement Docker                                    |
| IA intégrée           | Assistant de chat avec plus de 100 outils de design ; votre propre clé de fournisseur ou des crédits Cloud       | —                                                     |
| Agents et scripts     | Serveur MCP, CLI headless et scripts compatibles avec la Figma Plugin API                                        | Plugin API                                            |
| Mise en page          | Disposition automatique avec flexbox et CSS Grid                                                                 | Mise en page flex et grille                           |
| Jetons de design      | Variables avec modes ; import et export de jetons de design W3C                                                  | Jetons de design natifs                               |
| Export de code        | Design JSX, HTML, Vue et React avec CSS ou Tailwind                                                              | Inspection CSS, SVG et HTML                           |
| Prototypage           | Comportements de composants en direct ; flux et transitions sont sur la [feuille de route](/development/roadmap) | Flux, interactions et mode visualisation              |
| Rendu                 | Skia (CanvasKit) sur WebGL                                                                                       | SVG par défaut ; moteur WebGL en bêta                 |

## Fichiers Figma

OpenPencil ouvre directement les fichiers `.fig` et enregistre à nouveau en `.fig` : une équipe peut migrer sans convertir d’abord sa bibliothèque, et ceux qui restent sur Figma peuvent ouvrir le résultat. Copier des calques dans Figma et les coller dans OpenPencil conserve remplissages, contours, disposition automatique, texte, effets et réseaux vectoriels, et l’inverse fonctionne aussi. Voir [Compatibilité Figma](/fr/reference/figma-compatibility) pour ce qui est repris ou non.

Penpot utilise son propre format `.penpot`. Quitter Figma implique de recréer les designs ou de les convertir avec des outils tiers.

## IA et automatisation

OpenPencil est conçu pour être programmé. L’[assistant IA](/fr/user-guide/ai-chat) crée et modifie des calques avec les mêmes 100+ outils que le [serveur MCP](/developers/mcp-server) fournit à Claude Code, Cursor, Codex et d’autres agents de code, et l’application de bureau peut exécuter ces agents dans l’éditeur. La [CLI](/fr/developers/cli/inspecting) inspecte, analyse, convertit et exporte des documents sans ouvrir l’éditeur, et sa [commande `eval`](/fr/developers/cli/scripting) exécute des scripts écrits pour la Figma Plugin API.

Penpot dispose d’un système de plugins pour des extensions qui tournent dans l’éditeur. Il n’a ni assistant intégré, ni serveur MCP, ni scripts headless.

## Collaboration et hébergement

Penpot fonctionne en client-serveur : les documents vivent sur une instance Penpot, hébergée ou déployée par vos soins avec Docker, et chacun s’y connecte.

OpenPencil garde par défaut les documents sur votre appareil. Pour éditer à plusieurs, ouvrez une [salle pair-à-pair](/fr/user-guide/collaboration) sans serveur ni compte, avec curseurs en direct, mode suivi et appels vocaux. Pour le stockage partagé, les autorisations, les commentaires et l’historique des versions, utilisez [OpenPencil Cloud](/cloud/) : le service hébergé ou un [serveur géré par votre équipe](/cloud/self-hosting/) à partir du même code open source.

## Application de bureau

OpenPencil propose une application de bureau native pour macOS, Windows et Linux, d’environ 20 Mo, avec menus natifs, édition hors ligne et enregistrement automatique. Il fonctionne aussi dans le navigateur sur [cloud.openpencil.dev](https://cloud.openpencil.dev). Penpot fonctionne dans le navigateur.

## Là où Penpot a l’avantage

- **Maturité.** Penpot est utilisé en production depuis des années par de grandes équipes ; OpenPencil est plus jeune et a encore des aspérités.
- **Prototypage.** Penpot offre flux, interactions et mode présentation. OpenPencil prévisualise les composants comme des contrôles fonctionnels mais n’a pas encore de flux de prototype.
- **Écosystème de plugins.** Penpot dispose d’un catalogue de plugins communautaires ; les points d’extension d’OpenPencil sont aujourd’hui les scripts, MCP et le [SDK Vue](/fr/developers/sdk/).

## Lequel choisir

Choisissez OpenPencil si vous avez des fichiers Figma avec lesquels continuer à travailler, si vous voulez une application de bureau qui fonctionne hors ligne, ou si vous voulez que des agents IA et des scripts travaillent sur vos designs. Choisissez Penpot si vous avez besoin du prototypage dès aujourd’hui ou d’une plateforme plus éprouvée.
