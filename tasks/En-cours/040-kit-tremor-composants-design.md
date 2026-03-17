---
id: "040"
title: "Kit Tremor — composants .design"
status: en-cours
priority: moyenne
type: feature
complexity: M
depends-on: ["034"]
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Kit Tremor — composants .design

## Description

Créer le kit Tremor avec les composants dashboard et data visualization au format .design. Ce kit apporte les KPI cards, charts (placeholders structurels), data tables, et badge metrics pour les interfaces analytics.

## Criteres d'acceptation

- [ ] `design-kits/installed/tremor/kit.json` complet
- [ ] `design-kits/installed/tremor/tokens.json` (couleurs data viz, espacements dashboard)
- [ ] 6 composants .design :
  - [ ] KPI card (value + trend + sparkline placeholder)
  - [ ] Bar chart (placeholder structurel avec axes et barres)
  - [ ] Line chart (placeholder structurel avec axes et ligne)
  - [ ] Donut chart (placeholder structurel)
  - [ ] Data table (headers sticky, lignes alternées)
  - [ ] Badge metrics (valeur + variation + indicateur)
- [ ] Chaque composant avec `usageContext` : dashboard, analytics, data
- [ ] Registry mis à jour

## Plan d'implementation

### Fichiers impactes
- Nouveaux :
  - `design-kits/installed/tremor/kit.json`
  - `design-kits/installed/tremor/tokens.json`
  - `design-kits/installed/tremor/preview.png` (placeholder)
  - `design-kits/installed/tremor/components/kpi-card.design`
  - `design-kits/installed/tremor/components/bar-chart.design`
  - `design-kits/installed/tremor/components/line-chart.design`
  - `design-kits/installed/tremor/components/donut-chart.design`
  - `design-kits/installed/tremor/components/data-table.design`
  - `design-kits/installed/tremor/components/badge-metrics.design`
- Modifies : `design-kits/registry.json`

### Sous-taches
1. Définir les tokens Tremor (palette analytics : bleu, vert, rouge pour trends)
2. Créer `kit.json` avec métadonnées (category: "dashboard", aesthetic: "clean-data")
3. Créer les 6 composants .design avec structure de data viz
4. Mettre à jour `registry.json`

### Dependances a installer
- Aucune

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
Les charts sont des placeholders structurels (rectangles, lignes, cercles) qui représentent visuellement la structure d'un chart sans données réelles. L'IA utilisera ces structures comme base pour construire des dashboards.

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
