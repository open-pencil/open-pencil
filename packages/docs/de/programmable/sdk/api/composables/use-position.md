---
title: usePosition
description: Position, Größe, Drehung, Ausrichtung und Spiegelung der ausgewählten Objekte lesen und ändern.
---

# usePosition

`usePosition()` stellt `panelProp(key)` für `'x'`, `'y'`, `'width'`, `'height'` und `'rotation'` bereit: den Wert des Felds, auf zwei Nachkommastellen gerundet wie im Figma-Panel, oder `MIXED`, wenn sich die ausgewählten Ebenen unterscheiden. Die Ebenen behalten ihre genauen Werte. Dazu kommen Aktionen für Ausrichtung, Spiegelung, Drehung, Vorschau und Speichern numerischer Eigenschaften.

```ts
const position = usePosition()
const x = position.panelProp('x')
position.align('horizontal', 'center')
position.flip('horizontal')
position.rotate(90)
```

## Siehe auch

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
