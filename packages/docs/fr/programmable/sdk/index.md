---
title: Vue SDK
description: Créez des éditeurs propulsés par OpenPencil avec des composables Vue headless et des primitives.
---

# Vue SDK

`@open-pencil/vue` existe pour qu'OpenPencil puisse être bien plus qu'une application de design autonome.

L'objectif est de faire d'OpenPencil une boîte à outils intégrable dans d'autres produits, outils internes, et éditeurs spécialisés — pas seulement une interface par défaut.

L'application OpenPencil est une composition de cette boîte à outils. Le SDK est la façon dont vous en construisez une différente.

Il vous offre :

- un contexte éditeur injecté
- un rendu canvas via CanvasKit
- des composables pour la sélection, les commandes, les menus, les panneaux de propriétés et les variables
- des primitives structurelles headless comme `PageListRoot`, `PropertyListRoot` et `ToolbarRoot`
- des primitives i18n intégrées pour les menus, panneaux, dialogues et sélecteurs de langue personnalisés

## Par où commencer

<SdkCardGroup>
  <SdkCard title="Démarrage rapide" to="/programmable/sdk/getting-started" description="Installez le package, créez une instance d'éditeur et montez les primitives essentielles." />
  <SdkCard title="Architecture" to="/programmable/sdk/architecture" description="Comprenez comment composables, primitives et contexte éditeur s'articulent." />
  <SdkCard title="Guides" to="/programmable/sdk/guides/custom-editor-shell" description="Créez des shells personnalisés, des panneaux de propriétés et des panneaux de navigation." />
  <SdkCard title="Référence API" to="/programmable/sdk/api/" description="Parcourez les composants, composables et API avancées." />
</SdkCardGroup>

## Pourquoi le SDK existe

Différents produits et équipes ont besoin de surfaces d'édition différentes.

Parfois vous voulez un éditeur de design complet. Parfois vous voulez un canvas intégré dans une autre application. Parfois vous voulez un outil interne, un éditeur de templates, ou une surface d'édition assistée par IA construite autour d'un cas d'usage précis.

Le SDK est la couche qui rend tout cela possible.

## Principes de conception

- **Headless en priorité** : logique et structure, sans style applicatif
- **Composables plutôt que wrappers** : utiliser des composables quand il n'y a pas de coordination structurelle significative
- **API publique intentionnelle** : exports stables depuis `packages/vue/src/index.ts`
- **Intégration framework** : intégration Vue au-dessus de `@open-pencil/core`

## Comment penser ce package

Le SDK possède deux couches principales :

1. **Composables** pour l'état et les actions de l'éditeur
2. **Primitives** pour la structure UI significative

Si vous n'avez besoin que de l'état et des actions de l'éditeur, commencez par les composables.
Si vous construisez des blocs UI d'éditeur réutilisables, commencez par les primitives.

## Sections API

- [Composants](/programmable/sdk/api/components/)
- [Composables](/programmable/sdk/api/composables/)
- [Avancé](/programmable/sdk/api/advanced/)
