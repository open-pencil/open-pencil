---
title: useEffectsControls
description: Schatten und Unschärfen im Effekte-Panel verwalten.
---

# useEffectsControls

`useEffectsControls()` stellt Standardwerte, Einstellungen für Schatten und Unschärfen, den Zustand aufgeklappter Einträge, Vorschau beim Ziehen und Speichern des Endwerts bereit.

```ts
const { createDefaultEffect, scrubEffect, commitEffect } = useEffectsControls()

scrubEffect(node, index, { radius: 12 })
commitEffect(node, index, { radius: 12 })
```

## Siehe auch

- [PropertyListRoot](../components/property-list-root)
