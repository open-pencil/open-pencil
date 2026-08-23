---
title: useStrokeControls
description: Ausrichtung, Seiten und Stärke von Konturen im Eigenschaften-Panel verwalten.
---

# useStrokeControls

`useStrokeControls()` stellt Konturausrichtungen, Auswahl aller oder einzelner Seiten, einen Standardwert und Funktionen für unabhängige Seitenstärken bereit.

```ts
const { alignOptions, sideOptions, currentAlign, currentSides, selectSide } = useStrokeControls()
strokes.updateAlign('INSIDE', activeNode)
strokes.selectSide('TOP', activeNode)
```

## Siehe auch

- [PropertyListRoot](../components/property-list-root)
