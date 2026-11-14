---
layout: doc
title: Développeurs
description: Automatisez les fichiers de design depuis le terminal, laissez un agent AI piloter l’éditeur ou construisez votre propre éditeur sur le moteur OpenPencil.
---

# Développeurs

Tout ce que fait l’éditeur est aussi disponible en dehors : depuis le terminal, pour les agents AI et depuis le code. Tout repose sur le même moteur que l’application : ce que vous faites en cliquant, vous pouvez le faire par script. Choisissez l’outil selon ce que vous voulez construire.

## Automatiser les fichiers de design

La CLI `openpencil` lit, vérifie, exporte et modifie les fichiers `.fig` et `.pen` sans ouvrir l’application, et produit du JSON pour les scripts et la CI. Quand l’application de bureau est lancée, la même CLI la pilote : ouvrir et enregistrer des documents, annuler, modifier les réglages et appeler n’importe quel outil de l’éditeur.

<SdkCardGroup>
  <SdkCard title="Référence des commandes" to="/reference/cli" description="Toutes les commandes et leurs options." />
  <SdkCard title="Examiner des fichiers" to="/fr/developers/cli/inspecting" description="Pages, nœuds, requêtes XPath et variables de design." />
  <SdkCard title="Exporter" to="/fr/developers/cli/exporting" description="Images, JSX, HTML, variables de design et stories Storybook." />
  <SdkCard title="Scripting" to="/fr/developers/cli/scripting" description="La Figma Plugin API et une API openpencil via eval." />
</SdkCardGroup>

## Laisser un agent AI concevoir

Le serveur MCP donne à Claude Code, Cursor, Windsurf ou tout autre client MCP les 90 outils de l’assistant intégré : un agent peut ainsi lire, créer et modifier des designs. Les agents décrivent l’interface en JSX, qui crée de vrais cadres, textes et dispositions automatiques.

<SdkCardGroup>
  <SdkCard title="Serveur MCP" to="/developers/mcp-server" description="Connecter un client via stdio ou HTTP." />
  <SdkCard title="Moteur JSX" to="/fr/developers/jsx-renderer" description="Créer des arbres de composants à partir de JSX, et réexporter une sélection en JSX." />
  <SdkCard title="Référence du JSX de design" to="/reference/design-authoring" description="Ce que le JSX de design accepte." />
</SdkCardGroup>

Pour utiliser plutôt un agent dans l’application, voir [Chat avec l’AI](../user-guide/ai-chat) et [Agents de code](/user-guide/coding-agents).

## Construire votre propre éditeur

`@open-pencil/vue` est le Vue SDK avec lequel l’application est construite : contexte de l’éditeur, canevas, sélection, commandes et panneaux sans styles que vous habillez vous-même. Les bibliothèques du moteur fonctionnent sans Vue, dans le navigateur ou sur un serveur.

<SdkCardGroup>
  <SdkCard title="Vue SDK" to="/fr/developers/sdk/" description="Intégrer l’éditeur ou en construire un spécialisé." />
  <SdkCard title="API JavaScript natives" to="/developers/native-api" description="Les bibliothèques du moteur, sans l’interface." />
  <SdkCard title="Schéma d’URL" to="/fr/developers/url-scheme" description="Lier une page directement à un calque dans l’application." />
</SdkCardGroup>

## Sous le capot

<SdkCardGroup>
  <SdkCard title="Référence" to="/reference/node-types" description="Types de nœuds, graphe de scène, correspondance DOM/CSS et format de fichier." />
  <SdkCard title="Contribuer" to="/development/contributing" description="Compiler l’application, lancer les tests et proposer une modification." />
</SdkCardGroup>
