---
title: useSceneComputed
description: Реактивное вычисляемое значение на основе данных SceneGraph.
---

# useSceneComputed

`useSceneComputed(fn)` — небольшая обёртка над Vue `computed`, которая обозначает зависимость значения от данных SceneGraph редактора.

Используйте её в других composables, вычисляющих значения по объектам документа.

## См. также

- [useSelectionState](../composables/use-selection-state)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
- [useNodeProps](./use-node-props)
