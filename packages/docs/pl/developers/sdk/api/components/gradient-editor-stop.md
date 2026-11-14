---
title: GradientEditorStop
description: Stan i działania pojedynczego punktu gradientu.
---

<script setup lang="ts">
import { data } from '#docs-api/components/gradient-editor-stop.data'
</script>

# GradientEditorStop

`GradientEditorStop` udostępnia położenie, przezroczystość, kolor i stan aktywności punktu gradientu oraz działania aktualizacji i usuwania.

```vue
<GradientEditorStop :stop="stop" :index="index" :active="active" v-slot="ctx">
  <MyGradientStopRow v-bind="ctx" />
</GradientEditorStop>
```

<SdkComponentAPI :components="data.components" />

## Zobacz też

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
