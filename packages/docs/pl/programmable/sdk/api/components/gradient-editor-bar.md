---
title: GradientEditorBar
description: Interaktywny gradient bar do wybierania i przeciągania stops.
---

# GradientEditorBar

`GradientEditorBar` udostępnia state i pointer handlers potrzebne do wyrenderowania gradient bar. Obsługuje wybór oraz przeciąganie stops.

## Przykład

```vue
<GradientEditorBar
  :stops="stops"
  :active-stop-index="activeStopIndex"
  :bar-background="barBackground"
  @select-stop="selectStop"
  @drag-stop="dragStop"
  v-slot="ctx"
>
  <MyGradientBar v-bind="ctx" />
</GradientEditorBar>
```


## Zobacz też

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
