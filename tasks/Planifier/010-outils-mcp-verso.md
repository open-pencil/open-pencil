---
id: "010"
title: "Intégrer 5 outils MCP Verso dans packages/mcp/"
phase: 4
semaine: 9
priorite: haute
dependances: ["009", "004"]
---

## Description
Intégrer les 5 outils MCP spécifiques à Verso dans le serveur MCP d'OpenPencil : get_design_context, validate_design, get_design_guidelines, suggest_structure, save_as_design.

## Tâches
- [ ] Analyser le système MCP existant d'OpenPencil (tools, bridge, transport)
- [ ] Implémenter get_design_context — retourne le contexte de design assemblé pour le document courant
- [ ] Implémenter validate_design — exécute le validator et retourne les issues
- [ ] Implémenter get_design_guidelines — retourne les guidelines adaptées au type de design
- [ ] Implémenter suggest_structure — suggère une structure de nodes basée sur le contexte
- [ ] Implémenter save_as_design — sauvegarde le document courant en format .design
- [ ] Enregistrer les 5 outils dans le serveur MCP avec leurs schémas JSON
- [ ] Tester chaque outil via le bridge WebSocket
- [ ] Documenter les schémas d'entrée/sortie de chaque outil
- [ ] Tester l'intégration avec Claude Code via stdio

## Validation
- Les 5 outils apparaissent dans la liste des outils MCP
- Chaque outil retourne des résultats corrects via stdio et WebSocket
- Schémas JSON conformes au protocole MCP
- Intégration fonctionnelle avec Claude Code
