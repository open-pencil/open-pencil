---
title: PropertyListRoot
description: Bezstanowy prymityw strukturalny dla UI list wypełnień, obrysów i efektów.
---

# PropertyListRoot

`PropertyListRoot` to bezstanowy prymityw strukturalny dla edytorów właściwości opartych na tablicach.

Przeznaczony dla UI właściwości takich jak:

- wypełnienia
- obrysy
- efekty

Udostępnia przez slot właściwości dla:

- bieżących elementów
- wykrywania stanu mieszanego
- operacji dodawania/usuwania/aktualizacji/łatania
- przełączania widoczności per element

## Użycie

```vue
<PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
  <div v-for="(fill, index) in items" :key="index">
    <button @click="remove(index)">Usuń</button>
  </div>
  <button @click="add(defaultFill)">Dodaj wypełnienie</button>
</PropertyListRoot>
```

## Powiązane API

- [Przegląd API SDK](../)
