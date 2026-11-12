---
title: ToolbarRoot
description: Headless structural primitive for editor toolbar UIs.
---

# ToolbarRoot

`ToolbarRoot` is the headless toolbar primitive from `@open-pencil/vue`.

Use it when you want reusable toolbar structure and context with your own buttons, styling, and layout.

## Docking

The toolbar is placed the way Reka UI places popovers: `side` names the canvas edge (`top`, `right`, `bottom`, or `left`), and `align` its place along that edge (`start`, `center`, or `end`, where start is the left or top end). Bind them with `v-model:side` and `v-model:align`, or set `default-side` and `default-align` (`bottom` and `center`) and let the toolbar keep them.

The slot props and `useToolbar()` expose `side`, `align`, the derived `orientation` (`vertical` for `left` and `right`), and `popupSide`, the edge flyouts and tooltips open toward. Call `actions.setSide()` or `actions.setAlign()` from a menu inside the toolbar to move it.

```vue
<ToolbarRoot
  v-slot="{ side, align, orientation, popupSide, actions }"
  v-model:side="side"
  v-model:align="align"
>
  <MyToolbar
    :data-side="side"
    :data-align="align"
    :orientation="orientation"
    :menu-side="popupSide"
    @dock="actions.setSide"
  />
</ToolbarRoot>
```

## Related APIs

- [useEditorCommands](../composables/use-editor-commands)
- [useSelectionCapabilities](../composables/use-selection-capabilities)
