---
title: useSceneComputed
description: Reaktiver berechneter Wert auf Grundlage von SceneGraph-Daten.
---

# useSceneComputed

`useSceneComputed(fn)` ist eine kleine Hülle um Vue `computed`, die eine Abhängigkeit von den SceneGraph-Daten des Editors kennzeichnet.

Verwenden Sie sie in anderen Composables, die Werte aus Dokumentobjekten berechnen.

## Siehe auch

- [useSelectionState](../composables/use-selection-state)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
- [useNodeProps](./use-node-props)
