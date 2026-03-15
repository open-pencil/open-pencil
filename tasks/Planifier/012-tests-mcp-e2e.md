---
id: "012"
title: "Tests MCP + test E2E Claude Code workflow"
phase: 4
semaine: 10
priorite: haute
dependances: ["011"]
---

## Description
Écrire les tests unitaires pour tous les outils/prompts/resources MCP, et un test E2E du workflow complet avec Claude Code.

## Tâches
- [ ] Tests unitaires pour chaque outil MCP (get_design_context, validate_design, etc.)
- [ ] Tests unitaires pour chaque prompt MCP (design-page, design-system, refine-design)
- [ ] Tests unitaires pour la resource design://guidelines
- [ ] Test d'intégration du bridge WebSocket (aller-retour complet)
- [ ] Test E2E : Claude Code → prompt design-page → outils MCP → fichier .design créé
- [ ] Test E2E : Claude Code → prompt refine-design → validate_design → corrections
- [ ] Tester les cas d'erreur (document vide, contexte manquant, timeout)
- [ ] Ajouter les tests MCP dans le CI
- [ ] Documenter le setup de test E2E

## Validation
- Tests unitaires MCP > 90% couverture
- Tests E2E passent de bout en bout
- CI vérifie les tests MCP à chaque PR
- Workflow Claude Code documenté et reproductible
