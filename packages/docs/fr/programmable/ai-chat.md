---
title: Chat avec l’AI
description: Assistant intégré avec plus de 90 outils pour créer, modifier et analyser des designs.
---

# Chat avec l’AI

Appuyez sur <kbd>⌘</kbd><kbd>J</kbd> ou <kbd>Ctrl</kbd><kbd>J</kbd>. L’assistant peut créer des formes, modifier des styles, configurer des dispositions, travailler avec les composants et analyser le document.

## Configurer les modèles

Au premier lancement, la configuration guidée demande pour quoi l’IA doit vous aider et ce que vous utilisez déjà : un agent de code comme Claude Code, Codex ou Gemini CLI dans l’application de bureau, un compte API, ou un serveur local ou d’entreprise. Elle connecte cet accès et l’attribue aux rôles **Design agent** et **Vision**, sans toucher à ce que vous avez configuré à la main. Avec OpenRouter, il suffit de se connecter au lieu de coller une clé API. Vous pouvez la passer et la relancer depuis **Réglages → IA et agents → Lancer la configuration guidée**. Pour configurer les modèles à la main :

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

Les outils couvrent lecture, création, modification, structure, variables, vecteurs, analyse, description, génération de code et images de stock. L’inspection comprend `get_jsx` pour la vue JSX aller-retour, `diff_create` et `diff_jsx` pour les différences structurelles, `diff_visual` pour les différences de pixels et `describe` pour le rôle sémantique et la détection des problèmes de design. Chaque appel agit sur l’éditeur actif et participe à l’historique d’annulation lorsque cela s’applique.

## Vérification visuelle

L’assistant peut vérifier visuellement son travail. Lorsque `export_image` est activé, il peut capturer une image après avoir créé ou modifié des designs et comparer le résultat à la demande initiale. Cela permet de repérer les problèmes de disposition, les éléments manquants et les écarts de couleur qu’une réponse purement textuelle laisserait passer. `diff_visual`, activé par défaut, compare un objet modifié à une copie de référence et renvoie les pixels et la zone modifiés ; l’assistant peut ainsi confirmer qu’une modification est restée dans sa cible.

## Conseils

- Vous pouvez consulter d’autres pages pendant qu’une réponse est générée : l’assistant continue de travailler sur la page où le message a été envoyé, et ses aperçus s’affichent à votre retour. Pendant votre absence, le chat indique la page sur laquelle il travaille, avec **Aller à la page** pour y revenir. Si l’assistant change lui-même de page, votre vue le suit.

## Confidentialité et coût

Les requêtes sont envoyées au fournisseur configuré. Vérifiez ses conditions, sa politique de données et ses tarifs avant d’envoyer des documents sensibles. OpenPencil ne fournit pas de crédits de modèles.
