---
id: "034"
title: "Structure design-kits + registry + kit-store"
status: en-cours
priority: haute
type: feature
complexity: M
depends-on: []
branch: "feature/ui-kits-system"
pr: ""
created: "2026-03-17"
updated: "2026-03-17"
---

# Structure design-kits + registry + kit-store

## Description

Créer la fondation du système de UI Kits : la structure de dossiers `design-kits/`, le fichier `registry.json`, les types TypeScript pour `kit.json`, et le store Vue `kit-store.ts` qui gère le mode (unitaire/global) et les kits actifs.

## Criteres d'acceptation

- [ ] Dossier `design-kits/` créé avec `registry.json`, `installed/`, `community/`, `custom/`
- [ ] Types TypeScript pour `KitMeta` (kit.json), `KitComponent`, `KitStyle`, `KitCompatibility`
- [ ] `src/stores/kit-store.ts` fonctionnel avec mode unitaire/global, activation/désactivation de kits
- [ ] Registry chargé au démarrage avec la liste des kits installés
- [ ] API du store : `activateKit()`, `deactivateKit()`, `setMode()`, `getActiveKits()`, `getActiveComponents()`

## Plan d'implementation

### Fichiers impactes
- Nouveaux :
  - `design-kits/registry.json`
  - `design-kits/installed/.gitkeep`
  - `design-kits/community/.gitkeep`
  - `design-kits/custom/.gitkeep`
  - `packages/format/src/kit-schema.ts` (types kit.json)
  - `src/stores/kit-store.ts`
- Modifies : aucun

### Sous-taches
1. Créer la structure de dossiers `design-kits/`
2. Créer `registry.json` initial (tableau vide, avec schéma commenté)
3. Définir les types TypeScript dans `packages/format/src/kit-schema.ts` :
   - `KitMeta` (name, displayName, description, version, author, license, category, tags, style, compatibility, components, tokens, preview, stats)
   - `KitComponent` (id, name, file, variants, sizes, description, tags, usageContext)
   - `KitStyle` (aesthetic, radius, density, colorScheme)
   - `KitCompatibility` (frameworks, exportFormats)
4. Créer `src/stores/kit-store.ts` suivant le pattern factory de `editor.ts` :
   - State : `mode`, `activeKitIds`, `installedKits`
   - Computed : `activeKits`, `activeComponents`, `totalComponentCount`
   - Methods : `loadRegistry()`, `activateKit()`, `deactivateKit()`, `setMode()`, `getComponentsByContext()`
5. Fonction de chargement du registry au init

### Dependances a installer
- Aucune

## Notes

Tasks liées : 033, 034, 035, 036, 037, 038, 039, 040, 041
Ce store est global (pas par onglet). Pattern : `shallowReactive` + `useKitStore()` singleton.

## Historique

- 2026-03-17 : task créée (statut: planifier) — batch: Système UI Kits Verso
