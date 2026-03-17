---
id: "037"
title: "Migration specs hardcodees vers kits dynamiques"
status: done
priority: haute
type: refactor
complexity: M
depends-on: ["036"]
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Migration specs hardcodees vers kits dynamiques

## Description

Remplacer le système de specs JSX hardcodées dans `ui-kit-specs.ts` par un chargement dynamique depuis les kits actifs. Mettre à jour `verso-prompts.ts` pour utiliser les composants des kits actifs au lieu de `getAllSpecsAsPrompt()`.

## Criteres d'acceptation

- [ ] `ui-kit-specs.ts` utilise les fichiers .design des kits actifs au lieu de specs hardcodées
- [ ] `getAllSpecsAsPrompt()` retourne les specs des composants de TOUS les kits actifs
- [ ] `getComponentSpec(name)` résout le composant depuis les kits actifs (pas un tableau statique)
- [ ] `verso-prompts.ts` injecte les specs dynamiques dans les prompts 3-pass
- [ ] Rétrocompatibilité : si aucun kit n'est actif, fallback sur les specs shadcn par défaut
- [ ] Les prompts contiennent les noms de composants et leurs variants disponibles

## Plan d'implementation

### Fichiers impactes
- Nouveaux : aucun
- Modifies :
  - `packages/mcp/src/ui-kit-specs.ts` (refonte complète)
  - `packages/mcp/src/verso-prompts.ts` (mise à jour des injections de specs)

### Sous-taches
1. Refactorer `ui-kit-specs.ts` :
   - Remplacer le tableau statique `COMPONENT_SPECS` par une fonction qui lit les kits actifs
   - `getComponentSpec(name)` → cherche dans les .design des kits actifs
   - `getAllSpecsAsPrompt()` → concatène les specs de tous les kits actifs, groupées par kit
   - `getComponentNames()` → liste dynamique depuis les kits
2. Ajouter un mécanisme de cache (les .design ne changent pas souvent)
3. Mettre à jour `verso-prompts.ts` :
   - Le prompt `design-page` doit lister les kits actifs et leurs composants disponibles
   - Le prompt `design-system` doit inclure les tokens des kits actifs
   - Le prompt `refine-design` doit vérifier la cohérence inter-kits
4. Ajouter le fallback shadcn si aucun kit actif
5. Tester que les prompts générés sont corrects

### Dependances a installer
- Aucune

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
C'est le point de bascule : après cette task, le système utilise les kits dynamiques partout.
Les 11 composants hardcodés actuels correspondent à un sous-ensemble de shadcn — la migration doit être transparente.

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
- 2026-03-17 : implementation terminee — commit: c149b53
