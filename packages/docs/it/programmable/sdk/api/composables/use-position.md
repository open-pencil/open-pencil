---
title: usePosition
description: Leggi e aggiorna posizione, dimensione, rotazione, allineamento e capovolgimento del nodo selezionato.
---

# usePosition

`usePosition()` è un composable di controllo per la UI relativa alla posizione.

Espone valori del nodo selezionato come:

- `x`
- `y`
- `width`
- `height`
- `rotation`

e azioni come:

- allinea
- capovolgi
- ruota
- scrub/aggiorna proprietà numeriche

## Utilizzo

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Esempio base

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Esempi pratici

### Allinea i nodi selezionati

```ts
position.align('horizontal', 'center')
position.align('vertical', 'min')
```

### Capovolgi la selezione

```ts
position.flip('horizontal')
position.flip('vertical')
```

### Ruota la selezione

```ts
position.rotate(90)
```

## API correlate

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
