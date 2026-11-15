---
title: usePropertyList
description: Primitive context helper for PropertyListRoot descendants.
---

# usePropertyList

`usePropertyList()` reads the local property-list context provided by `PropertyListRoot`.

Use it inside descendants that need controlled items, mixed-state information, or row-level handlers for fills, strokes, or effects. It does not access an editor.

OpenPencil editor panels can use `useEditorPropertyList(propKey)` in an adapter component to connect the controlled primitive to selection, undo batching, and multi-node mutations.

## Related APIs

- [PropertyListRoot](../components/property-list-root)
- [PropertyListItem](../components/property-list-item)
