---
title: useColorVariableBinding
description: Helper per il binding delle variabili negli editor di colore per riempimenti e tratti.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` espone helper di ricerca, binding e unbinding per le variabili colore usate dagli editor di riempimenti e tratti.

Usalo quando costruisci UI colore che devono connettere riempimenti o tratti alle variabili di design.

## Utilizzo

```ts
import { useColorVariableBinding } from '@open-pencil/vue'

const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## API correlate

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [FillPickerRoot](../components/fill-picker-root)
