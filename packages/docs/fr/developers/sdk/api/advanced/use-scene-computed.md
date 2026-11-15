---
title: useSceneComputed
description: Computed value réactif basé sur les données de SceneGraph.
---

# useSceneComputed

`useSceneComputed(fn)` est un petit Wrapper de Vue `computed` qui identifie les Values dépendant des données SceneGraph de l’Editor.

Il convient aux autres composables qui calculent des Values à partir des objets du document.

## Voir aussi

- [useSelectionState](../composables/use-selection-state)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
- [useNodeProps](./use-node-props)
