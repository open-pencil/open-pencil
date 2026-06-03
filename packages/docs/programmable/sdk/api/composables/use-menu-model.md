---
title: useMenuModel
description: Build app and canvas menu models from the current editor state.
---

# useMenuModel

`useMenuModel()` builds higher-level menu structures on top of editor commands and selection state.

It is useful when you want ready-to-render menu groups instead of composing commands manually.

## Usage

```ts
import { useMenuModel } from '@inkly/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Basic example

```ts
const { canvasMenu } = useMenuModel()
```

Render `canvasMenu.value` into your context menu component.

## Practical examples

### App-style top menu

`appMenu` groups entries into:

- Edit
- View
- Object
- Arrange

### Context menu with page moves

`canvasMenu` includes dynamic items like “Move to page” based on current selection and available pages.

### Selection labels

`selectionLabelMenu` exposes context-sensitive labels like:

- `Hide` / `Show`
- `Lock` / `Unlock`

## Related APIs

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
