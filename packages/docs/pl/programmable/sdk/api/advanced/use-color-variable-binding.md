---
title: useColorVariableBinding
description: Pomocnik powiązania zmiennych dla edytorów kolorów wypełnień i obrysów.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` udostępnia pomocniki wyszukiwania, wiązania i odwiązania dla zmiennych kolorów używanych przez edytory wypełnień i obrysów.

Użyj go przy budowaniu UI kolorów, które muszą łączyć wypełnienia lub obrysy ze zmiennymi projektowymi.

## Użycie

```ts
import { useColorVariableBinding } from '@open-pencil/vue'

const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## Powiązane API

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [FillPickerRoot](../components/fill-picker-root)
