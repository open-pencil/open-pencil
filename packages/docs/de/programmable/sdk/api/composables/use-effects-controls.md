---
title: useEffectsControls
description: Effekte-Panel-Hilfsmittel für Schatten, Unschärfen, Erweiterungszustand und Scrub/Commit-Flows.
---

# useEffectsControls

`useEffectsControls()` ist das Effekte-Eigenschafts-Composable, das von Effekte-Panels verwendet wird.

Es bietet Hilfsmittel für:

- Standard-Effekte
- Schatten- vs. Unschärfe-Logik
- erweiterter Element-Zustand
- Scrub-Vorschau-Bearbeitung
- Commit-on-Finish-Aktualisierungen
- Effekttyp- und Farbänderungen

## Verwendung

```ts
import { useEffectsControls } from '@open-pencil/vue'

const effects = useEffectsControls()
```

## Einfaches Beispiel

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()
```

## Praktische Beispiele

### Einen Standard-Effekt hinzufügen

```ts
const effect = effects.createDefaultEffect()
```

### Scrub-Änderungen in der Vorschau, dann committen

```ts
effects.scrubEffect(node, index, { radius: 12 })
effects.commitEffect(node, index, { radius: 12 })
```

## Verwandte APIs

- [PropertyListRoot](../components/property-list-root)
