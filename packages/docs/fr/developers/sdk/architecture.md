---
title: Architecture du SDK
description: Structure du package, limites de l'API publique et principes de conception de @open-pencil/vue.
---

# Architecture du SDK

`@open-pencil/vue` relie `@open-pencil/core` à Vue.

Le modèle de l’éditeur reste dans le noyau. Ce paquet ajoute :

- la dependency injection avec Vue ;
- des composables réactifs ;
- des composants structurels sans styles ;
- la connexion de la zone de travail et la gestion des entrées.

## Structure du package

Le code est organisé par domaines fonctionnels.

### Familles de composants

- `Canvas/`
- `ColorPicker/`
- `FillPicker/`
- `FontPicker/`
- `GradientEditor/`
- `LayerTree/`
- `PageList/`
- `PropertyList/`
- `PropertySection/`
- `SegmentedControl/`
- `NumberField/`
- `Toolbar/`

Ces dossiers contiennent des composants structurels sans styles et des fonctions auxiliaires propres à chaque domaine.

### Controls

`controls/` contient les composables destinés aux panneaux de propriétés et aux commandes de l'éditeur :

- `usePosition`
- `useLayout`
- `useAppearance`
- `useColorModel`
- `useTypography`
- `useExport`
- `useFillControls`
- `useStrokeControls`
- `useEffectsControls`
- `useNodeProps`
- `usePropScrub`
- `useEditorPropertyList`

### Variables

`VariablesEditor/` contient les composables et le code qui relie l'état de l'éditeur de variables à Vue.

### Sélection

`selection/` contient l'état calculé à partir de la sélection et les informations sur les opérations disponibles.

### Contexte

`context/` contient la clé et les fonctions qui fournissent l’éditeur par injection de dépendances dans Vue :

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Internal

`internal/` contient des fonctions auxiliaires partagées. Elles ne font pas partie des principaux composants publics du paquet.

## Principes de l'API publique

### Des composables pour la logique et l'état

Si le code sert principalement à calculer ou gérer l'état, ou à exécuter des opérations de l'éditeur, exposez-le sous forme de composable.

### Des composants sans styles uniquement lorsque la structure est importante

Un composant racine est utile lorsqu'il coordonne la structure, les éléments enfants, les slots ou le contexte.

Exemples :

- `PageListRoot`
- `PropertyListRoot`
- `PropertySectionRoot`
- `SegmentedControlRoot`
- `ToolbarRoot`

### Ne transmettez pas tout le contexte par un seul emplacement

Ne transmettez à l’emplacement que les propriétés nécessaires ou utilisez directement le composable. Les composants contrôlés tels que `PropertyListRoot` émettent des événements sémantiques. La connexion à la sélection et à l’historique d’annulation doit se trouver dans un adaptateur ou un composable de contrôle, et non dans le composant lui-même.

## Responsabilités de l'application et du SDK

### SDK

- intégration avec l'éditeur ;
- logique réutilisable sans styles ;
- structure d'interface réutilisable et indépendante de la présentation ;
- intégration avec le rendu de la zone de travail.

### Application

- présentation ;
- mise en page générale ;
- routage ;
- ouverture, enregistrement et autres opérations sur les fichiers ;
- notifications, menus et comportements propres à l'application.

## Règle générale

Si du code peut être réutilisé dans un autre éditeur basé sur OpenPencil sans reprendre la présentation de l'application, il devrait probablement faire partie de `@open-pencil/vue`.

## Voir aussi

- [Premiers pas avec le SDK](./getting-started)
- [Référence de l'API](./api/)
