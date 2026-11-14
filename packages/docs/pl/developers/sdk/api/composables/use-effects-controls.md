---
title: useEffectsControls
description: Zarządzanie cieniami i rozmyciem w panelu efektów.
---

# useEffectsControls

`useEffectsControls()` dostarcza wartości domyślne nowych efektów, ustawienia cieni i rozmyć, stan rozwiniętych elementów, podgląd podczas przeciągania, zapis wartości końcowej oraz zmianę rodzaju i koloru efektu.

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()

const effect = createDefaultEffect()
scrubEffect(node, index, { radius: 12 })
commitEffect(node, index, { radius: 12 })
```

## Zobacz też

- [PropertyListRoot](../components/property-list-root)
