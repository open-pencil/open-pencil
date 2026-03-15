---
id: "011"
title: "Prompts MCP + Resource design://guidelines"
phase: 4
semaine: 9
priorite: haute
dependances: ["010"]
---

## Description
Ajouter les prompts MCP (design-page, design-system, refine-design) et la resource design://guidelines au serveur MCP Verso.

## Tâches
- [ ] Implémenter le prompt design-page — guide l'IA pour créer une page complète
- [ ] Implémenter le prompt design-system — guide l'IA pour créer un design system
- [ ] Implémenter le prompt refine-design — guide l'IA pour améliorer un design existant
- [ ] Implémenter la resource design://guidelines — expose les guidelines du Design Context Engine
- [ ] Enregistrer les prompts dans le serveur MCP avec leurs arguments
- [ ] Enregistrer la resource avec son URI et son type MIME
- [ ] Tester les prompts avec Claude Code (workflow complet)
- [ ] Valider que la resource retourne les guidelines correctes selon le contexte
- [ ] Documenter les prompts et la resource

## Validation
- Les 3 prompts sont listés et fonctionnels via MCP
- La resource design://guidelines est accessible et retourne du contenu pertinent
- Workflow Claude Code : prompt → tool calls → design créé/amélioré
