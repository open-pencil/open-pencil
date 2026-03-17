---
id: "036"
title: "Outils MCP UI Kits (5 outils)"
status: done
priority: haute
type: feature
complexity: L
depends-on: ["033", "034", "035"]
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Outils MCP UI Kits (5 outils)

## Description

Implémenter les 5 nouveaux outils MCP pour le système de UI Kits. Ces outils permettent à l'IA de lister les kits, rechercher des composants, obtenir les specs JSX, et insérer des composants sur le canvas.

## Criteres d'acceptation

- [ ] `get_available_kits` : liste les kits installés, filtrable par catégorie et statut actif
- [ ] `get_kit_components` : liste les composants d'un kit, filtrable par tag et usageContext
- [ ] `get_component_spec` : retourne le spec JSX render-ready d'un composant avec variant/size
- [ ] `suggest_components` : en mode Global, suggère les meilleurs composants parmi tous les kits actifs pour une tâche donnée
- [ ] `insert_kit_component` : insère un composant de kit sur le canvas avec overrides possibles
- [ ] Les 5 outils sont enregistrés dans le serveur MCP (via le module factorisé de la task 033)
- [ ] Chaque outil a un schema de params validé et une description claire

## Plan d'implementation

### Fichiers impactes
- Nouveaux : `packages/mcp/src/kit-tools.ts`
- Modifies : `packages/mcp/src/verso-tools.ts` (ajout des outils kits dans le registre)

### Sous-taches
1. Créer `kit-tools.ts` avec les 5 outils
2. `get_available_kits(category?, active_only?)` — lit `registry.json` + kit-store pour le statut actif
3. `get_kit_components(kitId, tag?, usageContext?)` — lit le `kit.json` du kit et filtre
4. `get_component_spec(kitId, componentId, variant?, size?)` — lit le `.design` du composant, résout les variables, retourne un template JSX
5. `suggest_components(taskDescription, elementType)` — utilise le classifieur du Design Context + matching multi-kits par usageContext et style.aesthetic
6. `insert_kit_component(kitId, componentId, variant?, size?, overrides?, parentId?, x?, y?)` — convertit le .design en nodes et les insère sur le canvas via le graph
7. Enregistrer les outils dans `verso-tools.ts` via `registerKitTools()`
8. Tester chaque outil avec le kit shadcn

### Dependances a installer
- Aucune

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
Les outils `get_available_kits`, `get_kit_components`, `get_component_spec`, `suggest_components` utilisent le pattern B (Verso-only, pas de browser). `insert_kit_component` pourrait nécessiter le pattern A (RPC vers browser) pour insérer sur le canvas.

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
- 2026-03-17 : implementation terminee — commit: e2af653
