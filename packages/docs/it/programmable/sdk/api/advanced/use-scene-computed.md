---
title: useSceneComputed
description: Wrapper computed di comodità per lo stato derivato dalla scena.
---

# useSceneComputed

`useSceneComputed(fn)` è un sottile wrapper computed usato per rendere esplicito lo stato derivato dalla scena nei composable di livello superiore.

Usalo quando vuoi stato computed che rivela chiaramente di dipendere dai dati della scena dell'editor.

## API correlate

- [useSelectionState](../composables/use-selection-state)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
- [useNodeProps](./use-node-props)
