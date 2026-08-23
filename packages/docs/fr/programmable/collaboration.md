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
- **Vue :** possibilité de suivre le cadrage d’une autre personne.

## Architecture

Yjs maintient l’état partagé sous forme de CRDT. Trystero découvre les participants et établit les connexions WebRTC. Un serveur de signalisation aide à initier la connexion, mais ne relaie pas le document.

Aucun compte ni déploiement propre n’est nécessaire. La qualité dépend du réseau et de la possibilité d’établir WebRTC entre les participants.

## Confidentialité

Le contenu n’est pas stocké sur un serveur OpenPencil. Chaque participant conserve une copie locale. Ne partagez le lien qu’avec des personnes de confiance.

## Fin de session

Lorsque la session se termine, les participants distants et leurs curseurs sont supprimés. Les changements déjà synchronisés restent dans le document local.
