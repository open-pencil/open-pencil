---
title: useVariables
description: Odczytywanie i zmiana kolekcji, zmiennych, trybów i wartości.
---

# useVariables

`useVariables()` udostępnia niskopoziomowy stan i działania edytora zmiennych.

Użyj composable do bezpośredniego zarządzania kolekcjami, aktywnymi trybami, filtrami i operacjami tworzenia, odczytu, aktualizacji i usuwania bez gotowej tabeli lub okna.

```ts
const variables = useVariables()
```

Zwracane dane obejmują `collections`, `activeCollection`, `activeModes`, `variables`, `searchTerm` oraz działania do tworzenia, przemianowywania, usuwania i aktualizowania zmiennych i kolekcji.

## Zobacz też

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariablesDialogState](./use-variables-dialog-state)
- [useVariablesTable](./use-variables-table)
