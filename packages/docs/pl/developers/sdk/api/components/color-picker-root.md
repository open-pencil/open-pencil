---
title: ColorPickerRoot
description: Komponent bez narzuconego wyglądu do wyboru koloru.
---

<script setup lang="ts">
import { data } from '#docs-api/components/color-picker-root.data'
</script>

# ColorPickerRoot

`ColorPickerRoot` udostępnia slot przycisku z wyglądem próbki, przycisk domyślny oraz slot zawartości z bieżącym kolorem i funkcją `update()`.

```vue
<ColorPickerRoot :color="color" @update="color = $event">
  <template #trigger="{ style }">
    <button class="size-6 rounded border" :style="style" />
  </template>
  <template #default="{ color, update }">
    <MyColorEditor :color="color" @change="update" />
  </template>
</ColorPickerRoot>
```

<SdkComponentAPI :components="data.components" />

## Zobacz też

- [ColorInputRoot](./color-input-root)
