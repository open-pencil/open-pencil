---
title: useVariableModes
description: Read and set the variable modes the selection or the current page shows.
---

# useVariableModes

`useVariableModes()` provides headless state and actions for Figma's Apply variable mode control: the collections a mode can be set for on the selection, or on the current page when nothing is selected, and the mode each one shows.

## Usage

```ts
import { useVariableModes } from '@open-pencil/vue/controls/variable-modes'

const { choices, applied, setMode } = useVariableModes()
```

- `choices` lists the collections with more than one mode that the selected layers use, through their own bindings or variables those alias; for a page, every such collection. Each has its `modes`, its `value` (the mode set on every target, `MIXED` when they differ, or `null` for Auto), and the `inherited` mode the targets show without one of their own.
- `applied` is the part of `choices` with a mode set on at least one target, which a panel shows as rows.
- `setMode(collectionId, modeId)` sets the mode on every target in one undo step; `null` clears it, so the targets inherit their parent's mode again.

`variableModeChoices(editor, nodes)` and `setVariableMode(editor, nodes, collectionId, modeId)` do the same for any layers, outside a component.

## Related APIs

- [useAppearance](./use-appearance)
- [SDK API Overview](../)
