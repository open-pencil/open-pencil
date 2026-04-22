---
title: useVariablesTable
description: Costruisce definizioni di colonne TanStack Table per le UI variabili di OpenPencil.
---

# useVariablesTable

`useVariablesTable(options)` restituisce definizioni di colonne reattive di TanStack Table per gli editor di variabili.

Usalo quando vuoi il comportamento di tabella variabili dell'SDK ma hai bisogno di fornire la tua istanza di tabella, icone personalizzate o componenti shell specifici dell'app.

## Utilizzo

```ts
import { useVariablesTable } from '@open-pencil/vue'

const { columns } = useVariablesTable(options)
```

## Note

- questo è un helper di integrazione specializzato per UI variabili guidate da tabelle
- la maggior parte dei consumatori dovrebbe iniziare con `useVariablesEditor()` a meno che non abbisogni di un controllo più granulare

## API correlate

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
