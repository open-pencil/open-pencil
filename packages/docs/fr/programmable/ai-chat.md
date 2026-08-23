---
title: Chat avec l’AI
description: Assistant intégré avec plus de 90 outils pour créer, modifier et analyser des designs.
---

# Chat avec l’AI

Appuyez sur <kbd>⌘</kbd><kbd>J</kbd> ou <kbd>Ctrl</kbd><kbd>J</kbd>. L’assistant peut créer des formes, modifier des styles, configurer des dispositions, travailler avec les composants et analyser le document.

## Configurer les modèles

1. Ouvrez le chat.
2. Sélectionnez l’icône des réglages.
3. Ajoutez un profil et configurez la connexion, l’identifiant du modèle, les identifiants d’accès et les capacités.

Plusieurs profils peuvent être enregistrés et attribués séparément au design, aux revues, aux tâches rapides et aux images. Les profils qui partagent une connexion réutilisent le même secret, conservé de manière sécurisée.

## Fournisseurs

OpenPencil prend en charge les connexions compatibles avec OpenAI et Anthropic, ainsi qu’OpenRouter, Google, Z.ai et des fournisseurs locaux.

Aucun serveur intermédiaire n’est utilisé. Les requêtes sont envoyées directement au fournisseur ; dans le navigateur, ses règles CORS s’appliquent. La fiabilité des appels d’outils en diffusion continue peut varier selon les déploiements. Consultez la [compatibilité BYOK](/programmable/byok-provider-compatibility).

## Agents ACP et MCP distant

L’application de bureau peut lancer des agents ACP et les connecter à des serveurs distants de confiance compatibles avec [Model Context Protocol](https://modelcontextprotocol.io/). Dans **Réglages → Connexions MCP**, ajoutez un point d’accès HTTP diffusé, un nom et, si nécessaire, un jeton Bearer.

Le jeton est conservé dans le stockage sécurisé des identifiants, pas dans les réglages ordinaires, et n’est récupéré qu’au démarrage de la session ACP.

## Outils

Les outils couvrent lecture, création, modification, structure, variables, vecteurs, analyse, description, génération de code et images de stock. Chaque appel agit sur l’éditeur actif et participe à l’historique d’annulation lorsque cela s’applique.

## Confidentialité et coût

Les requêtes sont envoyées au fournisseur configuré. Vérifiez ses conditions, sa politique de données et ses tarifs avant d’envoyer des documents sensibles. OpenPencil ne fournit pas de crédits de modèles.
