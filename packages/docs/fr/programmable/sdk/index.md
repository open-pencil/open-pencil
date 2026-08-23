---
title: Vue SDK
description: Créez des éditeurs basés sur OpenPencil avec des composants sans styles et des composables Vue.
---

# Vue SDK

`@open-pencil/vue` permet d'utiliser OpenPencil autrement que comme une application de design autonome.

Vous pouvez intégrer OpenPencil à un autre produit, à un outil interne ou à un éditeur spécialisé, sans reprendre l'interface par défaut de l'application.

L'application OpenPencil n'est qu'une des interfaces créées avec cette boîte à outils. Le SDK vous permet de construire la vôtre.

Le SDK fournit :

- le contexte de l'éditeur au moyen de la dependency injection de Vue ;
- le rendu de la zone de travail avec CanvasKit ;
- des composables pour la sélection, les commandes, les menus, les panneaux de propriétés et les variables ;
- des composants structurels sans styles tels que `PageListRoot`, `PropertyListRoot` et `ToolbarRoot` ;
- la localisation des menus, panneaux et boîtes de dialogue, ainsi que des composants de sélection de la langue.

## Par où commencer

<SdkCardGroup>
  <SdkCard title="Premiers pas" to="/programmable/sdk/getting-started" description="Installez le package, créez une instance de l'éditeur et connectez les composants principaux." />
  <SdkCard title="Architecture" to="/programmable/sdk/architecture" description="Découvrez comment les composables, les composants et le contexte de l'éditeur s'articulent." />
  <SdkCard title="Guides" to="/programmable/sdk/guides/custom-editor-shell" description="Créez une interface d'éditeur, des panneaux de propriétés et des panneaux de navigation sur mesure." />
  <SdkCard title="Référence de l'API" to="/programmable/sdk/api/" description="Consultez les composants, les composables et les API de bas niveau." />
</SdkCardGroup>

## À quoi sert le SDK

Chaque produit et chaque équipe a besoin d'une expérience d'édition différente.

Il peut s'agir d'un éditeur de design complet, d'une zone de travail intégrée à une autre application, d'un outil interne, d'un éditeur de modèles ou d'une interface spécialisée assistée par l'IA.

## Principes de conception

- **Sans styles par conception :** le SDK fournit la logique et la structure sans imposer l’apparence de l’application.
- **Un composable plutôt qu'un wrapper inutile :** si aucune structure d'interface ne doit être coordonnée, un composable suffit.
- **Une API publique maîtrisée :** les fonctionnalités stables sont exportées depuis `packages/vue/src/index.ts`.
- **Une intégration étroite avec Vue :** le SDK relie Vue aux fonctionnalités de `@open-pencil/core`.

## Deux niveaux d'API

Le SDK se compose de deux niveaux principaux :

1. Les **composables** fournissent l'état de l'éditeur et les opérations associées.
2. Les **composants** définissent une structure d'interface pertinente.

Si vous avez uniquement besoin de l'état et des opérations de l'éditeur, commencez par les composables. Si vous créez des éléments d'interface réutilisables, commencez par les composants.

## Sections de l'API

- [Composants](/programmable/sdk/api/components/)
- [Composables](/programmable/sdk/api/composables/)
- [API de bas niveau](/programmable/sdk/api/advanced/)
