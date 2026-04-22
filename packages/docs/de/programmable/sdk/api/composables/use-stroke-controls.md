---
title: useStrokeControls
description: Kontur-Panel-Hilfsmittel für Ausrichtung, Seitenauswahl und seitenspezifische Konturstärken.
---

# useStrokeControls

`useStrokeControls()` ist das Kontur-Eigenschafts-Composable, das von Kontur-Bearbeitungs-Panels verwendet wird.

Es bietet:

- Kontur-Ausrichtungsoptionen
- Seitenvoreinstellungen wie alle, oben, unten, links, rechts, benutzerdefiniert
- Standard-Konturdaten
- Hilfsmittel für seitenspezifische Rahmenbreiten

## Verwendung

```ts
import { useStrokeControls } from '@open-pencil/vue'

const strokes = useStrokeControls()
```

## Einfaches Beispiel

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
```

## Praktische Beispiele

### Konturausrichtung setzen

```ts
strokes.updateAlign('INSIDE', activeNode)
```

### Kontur auf eine Seite beschränken

```ts
strokes.selectSide('TOP', activeNode)
```

## Verwandte APIs

- [PropertyListRoot](../components/property-list-root)
