---
title: usePosition
description: Position, Größe, Rotation, Ausrichtung und Spiegelung ausgewählter Knoten lesen und aktualisieren.
---

# usePosition

`usePosition()` ist ein Steuerelemente-Composable für positions-bezogene UI.

Es gibt Werte für ausgewählte Knoten zurück wie:

- `x`
- `y`
- `width`
- `height`
- `rotation`

sowie Aktionen wie:

- ausrichten
- spiegeln
- rotieren
- numerische Eigenschaften scrubben/aktualisieren

## Verwendung

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Einfaches Beispiel

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Praktische Beispiele

### Ausgewählte Knoten ausrichten

```ts
position.align('horizontal', 'center')
position.align('vertical', 'min')
```

### Auswahl spiegeln

```ts
position.flip('horizontal')
position.flip('vertical')
```

### Auswahl rotieren

```ts
position.rotate(90)
```

## Verwandte APIs

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
