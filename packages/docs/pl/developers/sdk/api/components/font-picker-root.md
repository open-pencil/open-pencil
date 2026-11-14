---
title: FontPickerRoot
description: Wybór czcionki z wyszukiwaniem oparty na Reka UI Combobox.
---

# FontPickerRoot

`FontPickerRoot` zapewnia asynchroniczną listę rodzin czcionek i wyszukiwanie. Korzysta z Reka UI Combobox, ale aplikacja może zastąpić przycisk otwierający, pole wyszukiwania, wiersze, wskaźnik wyboru i pusty stan przez sloty.

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button class="w-full truncate">{{ value }}</button>
  </template>
</FontPickerRoot>
```

## Zobacz też

- [useTypography](../composables/use-typography)
