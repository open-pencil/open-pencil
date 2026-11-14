---
title: GradientEditorRoot
description: Stan i działania edytora punktów gradientu.
---

# GradientEditorRoot

`GradientEditorRoot` zarządza aktywnym punktem, rodzajem gradientu, dodawaniem, usuwaniem i aktualizacją punktów, kolorem aktywnego punktu oraz tłem paska gradientu.

Slot domyślny otrzymuje pełny zestaw danych i działań do zbudowania własnego interfejsu.

```vue
<GradientEditorRoot :fill="fill" @update="fill = $event" v-slot="ctx">
  <MyGradientUI v-bind="ctx" />
</GradientEditorRoot>
```

## Zobacz też

- [GradientEditorBar](./gradient-editor-bar)
- [GradientEditorStop](./gradient-editor-stop)
