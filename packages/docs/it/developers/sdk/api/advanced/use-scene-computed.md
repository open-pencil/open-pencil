---
title: useSceneComputed
description: Valore computed reattivo basato sui dati di SceneGraph.
---

# useSceneComputed

`useSceneComputed(fn)` è un piccolo wrapper di Vue `computed` che identifica i valori dipendenti dai dati SceneGraph dell’editor.

È utile negli altri composable che calcolano valori a partire dagli oggetti del documento.

## Vedi anche

- [useSelectionState](../composables/use-selection-state)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
- [useNodeProps](./use-node-props)
