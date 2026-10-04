---
title: Collaboration
description: Édition P2P en temps réel avec WebRTC et Yjs, sans serveur central.
---

# Collaboration

OpenPencil permet à plusieurs personnes de modifier un document en temps réel. Les changements circulent directement entre les participants par WebRTC.

## Démarrer une session

Ouvrez le menu de collaboration, créez une salle et partagez le lien. L’identifiant est généré avec un aléa cryptographique et ne contient aucune donnée du document.

## Données partagées

- **Document :** formes, texte, propriétés et disposition ;
- **Présence :** nom, couleur, sélection et page active ;
- **Curseurs :** position de chaque participant ;
- **Vue :** possibilité de suivre le cadrage d’une autre personne ;
- **Agents :** le chat AI intégré apparaît sous la forme d’un curseur sur les calques qu’il modifie, son étiquette cerclée affichant une étincelle et un nom de code tel que *Fern*. Le curseur et le contour ont la couleur de la personne qui l’utilise, ce qui permet de savoir à qui appartient l’agent. Seuls son nom, son type, son modèle, son état, sa page, sa position et les calques modifiés sont partagés, jamais les instructions ni les réponses.

## Mode suivi

Cliquez sur l’avatar d’une personne dans la barre supérieure pour suivre sa vue. Votre zone de travail se déplace et zoome comme la sienne, et un cadre de sa couleur avec une barre « Vous suivez … » indique qui vous suivez. Cliquez de nouveau sur l’avatar, appuyez sur <kbd>Esc</kbd>, ou cliquez, faites défiler, zoomez ou changez de page vous-même pour arrêter.

Un avatar compte les agents que cette personne utilise. Survolez-le pour voir chaque agent, ce qu’il fait et sur quelle page, puis cliquez sur **Suivre** à côté d’un agent pour garder à l’écran la page et les calques qu’il modifie ; le suivi se poursuit entre ses réponses et s’arrête quand il s’en va. Le bouton placé après les avatars énumère toutes les personnes de la salle avec leurs agents et fonctionne au clavier. Votre propre avatar énumère vos agents — cliquez sur l’un d’eux pour le renommer — et propose **Quitter la salle**.

Le panneau de partage énumère toutes les personnes de la salle avec les agents qu’elles utilisent, ce que fait chaque agent et sur quelle page. Suivez un agent de la même manière pour garder à l’écran la page et les calques qu’il modifie ; le suivi se poursuit entre ses réponses et s’arrête quand il s’en va. Double-cliquez sur l’un de vos agents pour le renommer.

## Architecture

Yjs maintient l’état partagé sous forme de CRDT. Trystero découvre les participants et établit les connexions WebRTC. Un serveur de signalisation aide à initier la connexion, mais ne relaie pas le document.

Aucun compte ni déploiement propre n’est nécessaire. La qualité dépend du réseau et de la possibilité d’établir WebRTC entre les participants.

## Confidentialité

Le contenu n’est pas stocké sur un serveur OpenPencil. Chaque participant conserve une copie locale. Ne partagez le lien qu’avec des personnes de confiance.

## Fin de session

Lorsque la session se termine, les participants distants et leurs curseurs sont supprimés. Les changements déjà synchronisés restent dans le document local.
