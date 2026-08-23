---
title: useVariablesTable
description: Definizioni delle colonne TanStack Table per un editor di variabili.
---

# useVariablesTable

`useVariablesTable(options)` restituisce definizioni reattive delle colonne per la tabella delle variabili.

Usalo quando serve il comportamento del SDK, ma istanza della tabella, icone o componenti vengono forniti separatamente.

```ts
const { columns } = useVariablesTable(options)
```

Per la maggior parte delle applicazioni, `useVariablesEditor()` è il punto di partenza più semplice. `useVariablesTable()` offre il controllo diretto della configurazione.

## Vedi anche

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
