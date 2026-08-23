---
title: useVariablesTable
description: Definicje kolumn TanStack Table dla edytora zmiennych.
---

# useVariablesTable

`useVariablesTable(options)` zwraca reaktywne definicje kolumn tabeli zmiennych.

Użyj composable, jeśli potrzebujesz zachowania SDK, ale egzemplarz tabeli, ikony lub komponenty dostarcza aplikacja.

```ts
const { columns } = useVariablesTable(options)
```

Dla większości aplikacji prostszym punktem wyjścia jest `useVariablesEditor()`. `useVariablesTable()` daje bezpośrednią kontrolę nad konfiguracją tabeli.

## Zobacz też

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
