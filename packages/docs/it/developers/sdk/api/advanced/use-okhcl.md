---
title: useOkHCL
description: Gestire i modelli di colore RGBA e OkHCL per riempimenti e contorni.
---

# useOkHCL

`useOkHCL()` legge e cambia il modello di colore usato da riempimenti e contorni. L’API può attivare o disattivare OkHCL e aggiornarne i valori.

Usalo in un selettore colore avanzato compatibile con RGBA e con il modello percettivo OkHCL.

```ts
const okhcl = useOkHCL()
```

L’API espone lettura del modello, attivazione, disattivazione e aggiornamento di OkHCL per riempimenti e contorni, oltre a `modelOptions`.

## Vedi anche

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [ColorPickerRoot](../components/color-picker-root)
