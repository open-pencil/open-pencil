---
id: "035"
title: "Kit shadcn/ui — composants .design"
status: done
priority: haute
type: feature
complexity: L
depends-on: ["034"]
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Kit shadcn/ui — composants .design

## Description

Créer le premier kit UI complet : shadcn/ui. Inclut les 22 composants .design (P0 + P1), le fichier `kit.json` avec métadonnées, `tokens.json` avec les design tokens, et un preview placeholder. C'est le kit de référence qui sert de modèle pour les autres.

## Criteres d'acceptation

- [ ] `design-kits/installed/shadcn/kit.json` complet avec les 22 composants référencés
- [ ] `design-kits/installed/shadcn/tokens.json` avec les tokens de design (couleurs, espacements, radius, typographie)
- [ ] 13 composants P0 : Button (6 variants, 3 sizes), Input (4 variants), Card (5 variants), Badge (4 variants), Nav bar, Separator, Stat card, Section header, Footer, Hero section, Feature card, CTA section
- [ ] 9 composants P1 : Avatar, Dialog, Table, Tabs, Toast, Dropdown, Alert, Pricing card, Social proof
- [ ] Chaque composant est un fichier `.design` valide avec `reusable: true`
- [ ] Les tokens utilisent le préfixe `$` pour les références de variables
- [ ] Le registry `design-kits/registry.json` est mis à jour avec l'entrée shadcn

## Plan d'implementation

### Fichiers impactes
- Nouveaux :
  - `design-kits/installed/shadcn/kit.json`
  - `design-kits/installed/shadcn/tokens.json`
  - `design-kits/installed/shadcn/preview.png` (placeholder)
  - `design-kits/installed/shadcn/components/button.design`
  - `design-kits/installed/shadcn/components/input.design`
  - `design-kits/installed/shadcn/components/card.design`
  - `design-kits/installed/shadcn/components/badge.design`
  - `design-kits/installed/shadcn/components/nav.design`
  - `design-kits/installed/shadcn/components/separator.design`
  - `design-kits/installed/shadcn/components/stat-card.design`
  - `design-kits/installed/shadcn/components/section-header.design`
  - `design-kits/installed/shadcn/components/footer.design`
  - `design-kits/installed/shadcn/components/hero-section.design`
  - `design-kits/installed/shadcn/components/feature-card.design`
  - `design-kits/installed/shadcn/components/cta-section.design`
  - `design-kits/installed/shadcn/components/avatar.design`
  - `design-kits/installed/shadcn/components/dialog.design`
  - `design-kits/installed/shadcn/components/table.design`
  - `design-kits/installed/shadcn/components/tabs.design`
  - `design-kits/installed/shadcn/components/toast.design`
  - `design-kits/installed/shadcn/components/dropdown.design`
  - `design-kits/installed/shadcn/components/alert.design`
  - `design-kits/installed/shadcn/components/pricing-card.design`
  - `design-kits/installed/shadcn/components/social-proof.design`
- Modifies : `design-kits/registry.json`

### Sous-taches
1. Définir les tokens shadcn dans `tokens.json` (palette neutral, radius 8px, font Inter)
2. Créer `kit.json` avec les métadonnées et la liste des 22 composants
3. Créer les 13 composants P0 (chacun avec variants et sizes)
4. Créer les 9 composants P1
5. Valider chaque fichier .design contre le schema `DesignDocument`
6. Mettre à jour `registry.json`

### Dependances a installer
- Aucune

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
Chaque composant .design suit la structure décrite dans UI-KITS.md : variables avec `$prefix`, frames avec `reusable: true`, variants nommées "Component / Variant / Size".
Le format des variables dans les .design de kits utilise `{ type, value }` — vérifier la compatibilité avec `DesignVariable` du schema.

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
- 2026-03-17 : implementation terminee — commit: d489ea0
