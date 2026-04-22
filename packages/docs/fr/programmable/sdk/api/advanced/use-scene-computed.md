---
title: useSceneComputed
description: Wrapper de computed pratique pour l'état dérivé de la scène.
---

# useSceneComputed

`useSceneComputed(fn)` est un thin wrapper de computed utilisé pour rendre explicite l'état dérivé de la scène dans les composables de plus haut niveau.

Utilisez-le quand vous voulez un état computed révélateur d'intention qui dépend clairement des données de la scène de l'éditeur.

## API associées

- [useSelectionState](../composables/use-selection-state)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
- [useNodeProps](./use-node-props)
