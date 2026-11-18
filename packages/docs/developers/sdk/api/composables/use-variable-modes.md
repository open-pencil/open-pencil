---
title: useVariableModes
description: Read and set the variable modes the selection or the current page shows.
---

# useVariableModes

`useVariableModes()` provides headless state and actions for a variable mode control, such as a frame's theme: the collections a mode can be set for on the selection, or on the current page when nothing is selected, and the mode each one shows.

## Usage

```ts
import { useVariableModes } from '@open-pencil/vue/controls/variable-modes'

const { choices, applied, setMode } = useVariableModes()
```

- `choices` lists every collection with more than one mode for pages and layers that hold others (frames, groups, sections, components, and instances), so a theme can be chosen before anything inside binds its variables; for other layers, only those whose variables they use, through their own bindings or variables those alias. A library copy with no variables is left out unless a target sets a mode in it. Each has its `label` (the collection name, numbered when collections share one), its `modes`, its `value` (the mode set on every target, `MIXED` when they differ, or `null` for Auto), and the `inherited` mode the targets show without one of their own.
- `applied` is the part of `choices` with a mode set on at least one target.
- `setMode(collectionId, modeId)` sets the mode on every target in one undo step; `null` clears it, so the targets inherit their parent's mode again.

`variableModeChoices(editor, nodes)` and `setVariableMode(editor, nodes, collectionId, modeId)` do the same for any layers, outside a component.

`collectionLabels(graph)` gives every collection's display name and numbers those that share a name, `Theme (1)` and `Theme (2)`, in the file's collection order.

## Related APIs

- [useAppearance](./use-appearance)
- [SDK API Overview](../)
