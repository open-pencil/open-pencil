---
id: "002"
title: "Explorer la codebase OpenPencil — cartographie complète"
phase: 1
semaine: 1
priorite: haute
dependances: ["001"]
---

## Description
Lire AGENTS.md et explorer en profondeur src/, packages/core/, packages/mcp/ pour comprendre l'architecture d'OpenPencil. Produire une cartographie de la codebase : modules, dépendances internes, points d'extension, patterns utilisés.

## Tâches
- [ ] Lire AGENTS.md et toute documentation existante
- [ ] Explorer src/ — identifier les composants UI, le système de routing, le state management
- [ ] Explorer packages/core/ — comprendre le scene graph, les types de nodes, le système de rendu
- [ ] Explorer packages/mcp/ — inventorier les outils MCP existants, le bridge, les prompts
- [ ] Identifier le format de fichier natif d'OpenPencil et sa sérialisation
- [ ] Cartographier les dépendances entre packages
- [ ] Documenter les points d'extension pour les features Verso
- [ ] Créer .claude/context/openpencil-map.md avec la cartographie

## Validation
- Cartographie complète documentée dans .claude/context/
- Chaque package a un résumé de son rôle et de ses exports principaux
- Points d'intégration Verso identifiés et listés
