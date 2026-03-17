---
id: "038"
title: "Interface UI Kit Browser"
status: en-cours
priority: moyenne
type: feature
complexity: XL
depends-on: ["034"]
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Interface UI Kit Browser

## Description

Créer l'interface complète de sélection et navigation des UI Kits. C'est une modale/page avec browse, search, preview, toggle unitaire/global, et barre des kits actifs. Cette interface doit être sublime — c'est une vitrine de la qualité de Verso. Utiliser le skill `/frontend-design`.

## Criteres d'acceptation

- [ ] `KitBrowser.vue` : modale pleine page avec layout catégorisé (Général, Dashboard, Effets)
- [ ] `KitCard.vue` : card de preview d'un kit avec hover animation, toggle Add/Active
- [ ] `KitDetail.vue` : page de détail avec preview, composants filtrables par tag, infos complètes
- [ ] `ActiveKitsBar.vue` : barre sticky montrant les kits activés (chips removable, compteur)
- [ ] Toggle Mode Unitaire / Global avec animation smooth
- [ ] Search par nom de kit, composant, ou tag
- [ ] Bouton d'accès dans le Toolbar principal
- [ ] Les kits s'activent/désactivent via le kit-store
- [ ] Preview des composants individuels (click → miniature rendue)
- [ ] Responsive et accessible

## Plan d'implementation

### Fichiers impactes
- Nouveaux :
  - `src/components/kits/KitBrowser.vue`
  - `src/components/kits/KitCard.vue`
  - `src/components/kits/KitDetail.vue`
  - `src/components/kits/ActiveKitsBar.vue`
  - `src/components/kits/ComponentPreview.vue`
  - `src/components/kits/KitModeToggle.vue`
- Modifies :
  - `src/components/Toolbar.vue` (ajout bouton Kit Browser)
  - Potentiellement `src/views/EditorView.vue` (intégration modale)

### Sous-taches
1. [ui] Créer `KitBrowser.vue` — layout principal avec DialogRoot (reka-ui), sections par catégorie, search
2. [ui] Créer `KitCard.vue` — card avec preview, nom, compteur composants, bouton toggle
3. [ui] Créer `KitDetail.vue` — vue détaillée d'un kit avec grille de composants filtrables
4. [ui] Créer `ActiveKitsBar.vue` — barre sticky avec chips des kits actifs
5. [ui] Créer `KitModeToggle.vue` — switch Unitaire/Global avec animation
6. [ui] Créer `ComponentPreview.vue` — miniature d'un composant rendu
7. Intégrer dans le Toolbar : bouton pour ouvrir le KitBrowser
8. Connecter tous les composants au kit-store
9. Ajouter animations et transitions (tw-animate-css)

### Dependances a installer
- Aucune (reka-ui, tailwind-variants, lucide déjà présents)

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
Modèle de référence : `VariablesDialog.vue` (554 lignes, modale 800px, reka-ui DialogRoot).
Conventions UI : Tailwind 4, `tailwind-variants` (tv), `unplugin-icons` (Lucide), pas de `<style>` blocks.
IMPORTANT : utiliser `/frontend-design` pour le design de chaque composant.

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
