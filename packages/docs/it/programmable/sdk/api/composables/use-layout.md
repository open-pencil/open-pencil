---
title: useLayout
description: Lavora con auto-layout, dimensionamento, padding, allineamento e tracce della griglia.
---

# useLayout

`useLayout()` è il composable di controllo principale per i pannelli relativi al layout.

Espone stato e azioni per:

- modalità flex vs grid
- dimensionamento larghezza/altezza
- padding
- allineamento
- modifica delle tracce dei template della griglia

## Utilizzo

```ts
import { useLayout } from '@open-pencil/vue'

const layout = useLayout()
```

## Esempio base

```ts
const {
  isGrid,
  isFlex,
  widthSizing,
  heightSizing,
  setWidthSizing,
  setHeightSizing,
} = useLayout()
```

## Esempi pratici

### Alterna tra UI di padding uniforme e individuale

```ts
layout.toggleIndividualPadding()
```

### Aggiorna le tracce della griglia

```ts
layout.updateGridTrack('gridTemplateColumns', 0, { sizing: 'FIXED', value: 240 })
layout.addTrack('gridTemplateRows')
```

### Cambia l'allineamento

```ts
layout.setAlignment('CENTER', 'MAX')
```

## API correlate

- [usePosition](./use-position)
- [useEditor](./use-editor)
