---
title: useColorVariableBinding
description: Powiązanie koloru zalewu lub obwiedni ze zmienną.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` udostępnia funkcje wyszukiwania, ustawiania i usuwania powiązania zmiennych kolorów w zalewach lub obwiedniach.

Użyj composable w elementach sterujących kolorem obsługujących zmienne projektu.

```ts
const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## Zobacz też

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
