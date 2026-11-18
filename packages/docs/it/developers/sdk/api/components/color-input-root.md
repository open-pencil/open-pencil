---
title: ColorInputRoot
description: Hex value e Color updates per un Color input personalizzato.
---

# ColorInputRoot

`ColorInputRoot` converte il Color value corrente in Hex e fornisce Functions per aggiornarlo tramite Hex string oppure oggetto `Color` completo.

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## Vedi anche

- [ColorPickerRoot](./color-picker-root)
