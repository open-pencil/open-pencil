---
title: ColorInputRoot
description: Odczyt wartości szesnastkowej i aktualizacja koloru we własnym polu.
---

# ColorInputRoot

`ColorInputRoot` przekształca bieżący kolor na zapis szesnastkowy i udostępnia funkcje aktualizacji z ciągu tekstowego albo pełnego obiektu `Color`.

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## Zobacz też

- [ColorPickerRoot](./color-picker-root)
