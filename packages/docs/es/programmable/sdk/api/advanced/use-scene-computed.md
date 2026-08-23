---
title: useSceneComputed
description: Computed value reactivo basado en datos de SceneGraph.
---

# useSceneComputed

`useSceneComputed(fn)` es un pequeño Wrapper de Vue `computed` que identifica Values dependientes de los datos de SceneGraph del Editor.

Resulta útil en otros composables que calculan Values a partir de objetos del documento.

## Consulta también

- [useSelectionState](../composables/use-selection-state)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
- [useNodeProps](./use-node-props)
