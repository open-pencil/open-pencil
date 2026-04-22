---
title: useColorVariableBinding
description: Variablen-Bindungs-Hilfsmittel für Füllungs- und Kontur-Farb-Editoren.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` gibt Such-, Bindungs- und Entbindungs-Hilfsmittel für Farbvariablen zurück, die von Füllungs- und Kontur-Editoren verwendet werden.

Verwenden Sie es beim Erstellen von Farb-UIs, die Füllungen oder Konturen mit Design-Variablen verbinden müssen.

## Verwendung

```ts
import { useColorVariableBinding } from '@open-pencil/vue'

const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## Verwandte APIs

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [FillPickerRoot](../components/fill-picker-root)
