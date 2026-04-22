---
title: usePosition
description: Odczytuj i aktualizuj pozycję, rozmiar, obrót, wyrównanie i odbicie zaznaczonego węzła.
---

# usePosition

`usePosition()` to kompozyt kontrolek dla UI związanego z pozycją.

Udostępnia wartości zaznaczonego węzła takie jak:

- `x`
- `y`
- `width`
- `height`
- `rotation`

i akcje takie jak:

- wyrównanie
- odbicie
- obrót
- przeciąganie/aktualizacja właściwości liczbowych

## Użycie

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Podstawowy przykład

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Przykłady praktyczne

### Wyrównaj zaznaczone węzły

```ts
position.align('horizontal', 'center')
position.align('vertical', 'min')
```

### Odbij selekcję

```ts
position.flip('horizontal')
position.flip('vertical')
```

### Obróć selekcję

```ts
position.rotate(90)
```

## Powiązane API

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
