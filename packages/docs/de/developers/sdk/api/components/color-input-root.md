---
title: ColorInputRoot
description: Hexadezimalwert und Farbaktualisierung für ein eigenes Farbfeld.
---

# ColorInputRoot

`ColorInputRoot` wandelt den aktuellen Farbwert in Hexadezimalschreibweise um und stellt Funktionen zur Aktualisierung aus einer Zeichenfolge oder einem vollständigen `Color`-Objekt bereit.

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## Siehe auch

- [ColorPickerRoot](./color-picker-root)
