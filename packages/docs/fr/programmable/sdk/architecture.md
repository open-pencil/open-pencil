---
title: Architecture SDK
description: Structure des dossiers, frontières d'API publique et patterns de composition dans @open-pencil/vue.
---

# Architecture SDK

`@open-pencil/vue` est la couche Vue au-dessus de `@open-pencil/core`.

Elle ne possède pas le modèle d'éditeur lui-même. Elle adapte l'éditeur core en :

- injection Vue
- composables réactifs
- primitives structurelles headless
- câblage canvas et input

## Structure des dossiers

Ce package est organisé par domaine.

### Familles de composants

- `Canvas/`
- `ColorPicker/`
- `FillPicker/`
- `FontPicker/`
- `GradientEditor/`
- `LayerTree/`
- `PageList/`
- `PropertyList/`
- `ScrubInput/`
- `Toolbar/`

Ces dossiers contiennent des primitives structurelles/headless et des helpers locaux.

### Contrôles

`controls/` contient les composables de contrôles pour les panneaux de propriétés et l'éditeur :

- `usePosition`
- `useLayout`
- `useAppearance`
- `useTypography`
- `useExport`
- `useFillControls`
- `useStrokeControls`
- `useEffectsControls`
- `useNodeProps`
- `usePropScrub`

### Variables

`VariablesEditor/` contient les composables du domaine variables et le câblage d'état.

### Sélection

`selection/` contient l'état de l'éditeur dérivé de la sélection et les capacités associées.

### Contexte

`context/` contient les helpers d'injection de l'éditeur :

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Interne

`internal/` contient des utilitaires transversaux non destinés à être des primitives headless principales.

## Philosophie d'API publique

### Préférer les composables

Si le problème est principalement de la logique de contrôle, de la dérivation d'état ou des actions éditeur, exposer un composable.

### Réserver les primitives headless aux structures significatives

Utiliser des racines de composants quand ils coordonnent une structure, des enfants, des slots ou du contexte.

Exemples :

- `PageListRoot`
- `PropertyListRoot`
- `ToolbarRoot`

### Éviter les slots fourre-tout de contexte

Préférer des props de slot ciblés ou l'usage direct de composables plutôt que des payloads `v-slot="ctx"` massifs.

## Responsabilités SDK vs Application

### Le SDK possède

- l'intégration éditeur
- la logique headless réutilisable
- la structure UI réutilisable sans hypothèses de style
- l'intégration du rendu canvas

### L'application possède

- les styles
- les shells de mise en page
- le routage
- les flux de fichiers du produit
- les toasts, menus et UX spécifiques à l'application

## Règle pratique

Si un morceau de logique pourrait être réutilisé dans une autre application basée sur OpenPencil sans emporter les styles applicatifs, il appartient probablement à `@open-pencil/vue`.

## Pages associées

- [Démarrage rapide SDK](./getting-started)
- [Référence API](./api/)
