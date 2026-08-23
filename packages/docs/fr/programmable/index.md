---
layout: doc
title: Automatisation et API
description: AI, MCP, CLI, JSX et Figma Plugin API pour automatiser les designs.
---

# Automatisation et API

OpenPencil traite les fichiers de design comme des données structurées. Les opérations de l’éditeur — créer des formes, modifier des remplissages, configurer la disposition automatique ou exporter des ressources — sont aussi disponibles via la CLI, des agents AI et des API.

## Chat avec l’AI

L’assistant intégré exécute plus de 90 outils. Une instruction peut modifier les ombres de plusieurs boutons, créer un composant avec une variante sombre ou exporter tous les cadres d’une page à l’échelle 2×.

[Chat avec l’AI →](./ai-chat)

## MCP

Claude Code, Cursor, Windsurf et d’autres clients MCP peuvent utiliser les mêmes outils. Le serveur prend en charge stdio et HTTP avec des sessions indépendantes.

[Serveur MCP →](/programmable/mcp-server)

## CLI

La CLI examine, exporte et analyse les fichiers `.fig` sans ouvrir l’éditeur. Elle peut lister pages et objets, rechercher du contenu, extraire des variables de design et générer des PNG. `--json` facilite l’intégration avec la CI.

[CLI →](./cli/inspecting)

## JSX

Une interface peut être décrite de manière déclarative en JSX. Un seul appel crée un arbre complet de cadres, textes, dispositions, remplissages et contours.

Dans l’autre sens, OpenPencil exporte une sélection en JSX ou HTML avec des classes Tailwind, comme point de départ pour l’implémentation ou la revue de code.

[Moteur JSX →](./jsx-renderer)

## Figma Plugin API

La commande `eval` exécute JavaScript avec un objet global `figma` compatible. Elle permet d’interroger et modifier des documents, puis d’enregistrer le résultat.

[Scripting avec `eval` →](./cli/scripting)

OpenPencil est sous licence MIT et conserve les documents localement. Les fichiers `.fig` peuvent être examinés, transformés, traités en CI ou fournis comme contexte à un modèle sans dépendre d’un hébergeur particulier.
