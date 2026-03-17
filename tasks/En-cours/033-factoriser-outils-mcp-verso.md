---
id: "033"
title: "Factoriser outils MCP Verso (server/stdio)"
status: en-cours
priority: haute
type: refactor
complexity: S
depends-on: []
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Factoriser outils MCP Verso (server/stdio)

## Description

Extraire les 5 outils Verso actuellement dupliqués entre `server.ts` et `stdio.ts` dans un module partagé `verso-tools.ts`. Cette factorisation est un prérequis pour ajouter proprement les 5 outils MCP de UI Kits sans doubler la duplication.

## Criteres d'acceptation

- [ ] Les 5 outils Verso (get_design_context, validate_design, suggest_structure, save_as_design, get_design_guidelines) sont dans un module partagé
- [ ] `server.ts` et `stdio.ts` importent et enregistrent les outils depuis ce module
- [ ] Zéro duplication de logique entre server.ts et stdio.ts pour les outils Verso
- [ ] Les outils fonctionnent identiquement (pas de régression)
- [ ] Le module expose une API claire pour enregistrer des outils additionnels (kits)

## Plan d'implementation

### Fichiers impactes
- Nouveaux : `packages/mcp/src/verso-tools.ts`
- Modifies : `packages/mcp/src/server.ts`, `packages/mcp/src/stdio.ts`

### Sous-taches
1. Créer `verso-tools.ts` avec une fonction `registerVersoTools(server, options)` qui enregistre les 5 outils
2. Extraire la logique des outils de `server.ts` (lignes 275-393) vers ce module
3. Modifier `server.ts` pour appeler `registerVersoTools()`
4. Modifier `stdio.ts` pour appeler `registerVersoTools()`
5. Vérifier que les prompts et resources MCP ne sont pas affectés
6. Tester manuellement que les 5 outils répondent correctement

### Dependances a installer
- Aucune

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
Ce refactoring prépare le terrain pour la task 036 (outils MCP UI Kits).

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
