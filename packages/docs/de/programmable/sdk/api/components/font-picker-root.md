---
title: FontPickerRoot
description: Schriftauswahl mit Suche auf Grundlage von Reka UI Combobox.
---

# FontPickerRoot

`FontPickerRoot` stellt eine asynchron geladene Liste von Schriftfamilien und eine Suche bereit. Die Anwendung kann Schaltfläche, Suchfeld, Einträge, Auswahlmarkierung und Leerdarstellung über Slots ersetzen.

```vue
<FontPickerRoot v-model="fontFamily" :list-families="listFamilies">
  <template #trigger="{ value }">
    <button>{{ value }}</button>
  </template>
</FontPickerRoot>
```

## Siehe auch

- [useTypography](../composables/use-typography)
