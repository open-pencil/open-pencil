---
title: useOkHCL
description: Obsługa modeli kolorów RGBA i OkHCL dla zalewów oraz obwiedni.
---

# useOkHCL

`useOkHCL()` odczytuje i zmienia model koloru używany przez zalewy oraz obwiednie. Pozwala włączyć albo wyłączyć OkHCL i aktualizować jego wartości.

Użyj composable w zaawansowanym selektorze koloru obsługującym zarówno RGBA, jak i percepcyjny model OkHCL.

```ts
const okhcl = useOkHCL()
```

Zwracane API obejmuje odczyt modelu i koloru, włączanie, wyłączanie i aktualizację OkHCL oraz `modelOptions`.

## Zobacz też

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
