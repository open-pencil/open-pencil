---
id: "041"
title: "Integration workflow 3 passes avec kits"
status: done
priority: moyenne
type: feature
complexity: M
depends-on: ["037"]
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Integration workflow 3 passes avec kits

## Description

Modifier le workflow de design 3 passes (skeleton -> content -> refine) pour utiliser les composants des kits actifs. Le classifieur de tâches suggère automatiquement les meilleurs composants de chaque kit actif, et le refine pass vérifie la cohérence inter-kits.

## Criteres d'acceptation

- [ ] Le prompt `design-page` inclut la liste des kits actifs et leurs composants disponibles
- [ ] Pass 1 (skeleton) : utilise les composants structurels des kits (card, nav, section) pour le layout
- [ ] Pass 2 (content) : utilise les composants spécifiques des kits (hero, CTA, stats) avec les bons variants
- [ ] Pass 3 (refine) : vérifie la cohérence visuelle entre composants de kits différents
- [ ] Le classifieur (`classifyTask`) influence le choix des composants par kit
- [ ] En mode Global avec plusieurs kits, l'IA pioche intelligemment dans chaque kit
- [ ] Les task-templates JSON incluent des recommandations de composants par kit

## Plan d'implementation

### Fichiers impactes
- Nouveaux : aucun
- Modifies :
  - `packages/mcp/src/verso-prompts.ts` (enrichir les 3 prompts avec contexte kits)
  - `packages/design-context/src/assembler.ts` (option `activeKits` dans `assembleContext`)
  - `packages/design-context/src/classifier.ts` (enrichir le matching avec usageContext des kits)
  - `packages/design-context/task-templates/*.json` (ajouter `recommendedKitComponents`)

### Sous-taches
1. Enrichir `assembleContext()` avec un paramètre `activeKits` qui ajoute les composants disponibles au contexte
2. Mettre à jour les task-templates JSON pour inclure des `recommendedKitComponents` par type de page
3. Modifier le prompt `design-page` pass 1 (skeleton) : lister les composants structurels disponibles
4. Modifier le prompt `design-page` pass 2 (content) : lister les composants spécifiques avec variants
5. Modifier le prompt `refine-design` : ajouter des règles de cohérence inter-kits
6. Enrichir `classifyTask()` pour mapper les types de tâches aux usageContext des composants
7. Tester le workflow complet avec shadcn seul, puis avec shadcn + Aceternity + Tremor

### Dependances a installer
- Aucune

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
C'est la task finale qui fait fonctionner le mode Global de bout en bout.
Exemple concret du mode Global (landing SaaS avec shadcn + Aceternity + Tremor) :
- Nav → shadcn, Hero → Aceternity (spotlight), Feature cards → Aceternity (glowing), Stats → Tremor (KPI cards), Data preview → Tremor (charts), CTA → shadcn, Footer → shadcn.

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
- 2026-03-17 : implementation terminee — commit: 50e6918
