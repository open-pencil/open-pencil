---
title: useColorVariableBinding
description: Collegare il colore di un riempimento o contorno a una variabile.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` fornisce funzioni per cercare, impostare e rimuovere il collegamento di variabili colore nei riempimenti o contorni.

Usa il composable nei controlli colore compatibili con le variabili di design.

```ts
const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## Vedi anche

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
