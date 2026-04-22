---
title: useTypography
description: Lee y actualiza la familia tipográfica, el peso, el tamaño, la alineación y el formato para nodos de texto.
---

# useTypography

`useTypography()` es el composable de control de propiedades de texto para los paneles de edición de texto.

Expone:

- familia tipográfica
- peso tipográfico
- tamaño de fuente
- estado de formato
- estado de fuente faltante
- helpers para cambiar familia, peso, alineación y decoraciones

## Uso

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Ejemplo básico

```ts
const {
  fontFamily,
  fontWeight,
  fontSize,
  activeFormatting,
  setFamily,
  setWeight,
  setAlign,
} = useTypography()
```

## Ejemplos prácticos

### Cargar y cambiar una familia tipográfica

```ts
const typography = useTypography({
  loadFont: async (family, style) => {
    await myFontLoader(family, style)
  },
})
```

### Alternar el formato

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
```

## APIs relacionadas

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
