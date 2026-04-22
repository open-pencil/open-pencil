---
title: useVariablesTable
description: Buduj definicje kolumn TanStack Table dla UI zmiennych OpenPencil.
---

# useVariablesTable

`useVariablesTable(options)` zwraca reaktywne definicje kolumn TanStack Table dla edytorów zmiennych.

Użyj go, gdy chcesz zachowanie tabeli zmiennych SDK, ale musisz dostarczyć własną instancję tabeli, niestandardowe ikony lub komponenty powłoki specyficzne dla aplikacji.

## Użycie

```ts
import { useVariablesTable } from '@open-pencil/vue'

const { columns } = useVariablesTable(options)
```

## Uwagi

- to jest wyspecjalizowany pomocnik integracji dla UI zmiennych opartych na tabelach
- większość konsumentów powinna zacząć od `useVariablesEditor()`, chyba że potrzebuje większej kontroli

## Powiązane API

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
