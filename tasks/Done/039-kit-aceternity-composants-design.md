---
id: "039"
title: "Kit Aceternity — composants .design"
status: done
priority: moyenne
type: feature
complexity: L
depends-on: ["034"]
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Kit Aceternity — composants .design

## Description

Créer le kit Aceternity UI avec les composants "wow effect" au format .design. Ce kit apporte les effets visuels premium : glowing cards, spotlight, moving borders, text generate, bento grid, background beams, shimmer button.

## Criteres d'acceptation

- [ ] `design-kits/installed/aceternity/kit.json` complet
- [ ] `design-kits/installed/aceternity/tokens.json` (couleurs glow, gradients, animations)
- [ ] 7 composants .design :
  - [ ] Glowing card (border gradient animé)
  - [ ] Spotlight effect (background lumineux)
  - [ ] Moving border (animated border)
  - [ ] Text generate effect (texte lettre par lettre)
  - [ ] Animated bento grid
  - [ ] Background beams
  - [ ] Shimmer button
- [ ] Chaque composant avec `usageContext` approprié (hero, feature, cta, etc.)
- [ ] Registry mis à jour

## Plan d'implementation

### Fichiers impactes
- Nouveaux :
  - `design-kits/installed/aceternity/kit.json`
  - `design-kits/installed/aceternity/tokens.json`
  - `design-kits/installed/aceternity/preview.png` (placeholder)
  - `design-kits/installed/aceternity/components/glowing-card.design`
  - `design-kits/installed/aceternity/components/spotlight.design`
  - `design-kits/installed/aceternity/components/moving-border.design`
  - `design-kits/installed/aceternity/components/text-generate.design`
  - `design-kits/installed/aceternity/components/bento-grid.design`
  - `design-kits/installed/aceternity/components/background-beams.design`
  - `design-kits/installed/aceternity/components/shimmer-button.design`
- Modifies : `design-kits/registry.json`

### Sous-taches
1. Définir les tokens Aceternity (gradients, glow colors, animation timings)
2. Créer `kit.json` avec métadonnées (category: "effects", aesthetic: "premium-glow")
3. Créer les 7 composants .design avec effets visuels structurels
4. Mettre à jour `registry.json`

### Dependances a installer
- Aucune

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
Les effets d'animation (glow, shimmer, beams) sont représentés structurellement dans le .design (gradients, overlays, layers) — pas d'animations CSS réelles dans le format .design. L'animation est simulée visuellement par la structure des éléments.

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
- 2026-03-17 : implementation terminee — commit: 3a4d2b6
