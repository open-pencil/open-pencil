---
title: usePosition
description: Position, Größe, Drehung, Ausrichtung und Spiegelung der ausgewählten Objekte lesen und ändern.
---

# usePosition

`usePosition()` stellt `x`, `y`, `width`, `height` und `rotation` sowie Aktionen für Ausrichtung, Spiegelung, Drehung, Vorschau und Speichern numerischer Eigenschaften bereit.

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
position.align('horizontal', 'center')
position.flip('horizontal')
position.rotate(90)
```

## Siehe auch

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
