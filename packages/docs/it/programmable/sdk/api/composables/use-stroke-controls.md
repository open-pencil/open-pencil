---
title: useStrokeControls
description: Helper del pannello tratti per allineamento, selezione del lato e pesi dei tratti per lato.
---

# useStrokeControls

`useStrokeControls()` è il composable delle proprietà dei tratti usato dai pannelli di modifica dei tratti.

Fornisce:

- opzioni di allineamento del tratto
- preset di lato come tutti, alto, basso, sinistra, destra, personalizzato
- dati del tratto predefinito
- helper per i pesi dei bordi per lato

## Utilizzo

```ts
import { useStrokeControls } from '@open-pencil/vue'

const strokes = useStrokeControls()
```

## Esempio base

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
```

## Esempi pratici

### Imposta l'allineamento del tratto

```ts
strokes.updateAlign('INSIDE', activeNode)
```

### Limita un tratto a un solo lato

```ts
strokes.selectSide('TOP', activeNode)
```

## API correlate

- [PropertyListRoot](../components/property-list-root)
