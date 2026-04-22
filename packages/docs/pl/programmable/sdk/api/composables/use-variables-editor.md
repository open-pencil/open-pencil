---
title: useVariablesEditor
description: Komponuj stan okna dialogowego zmiennych, kolumny tabeli i okablowanie TanStack Table.
---

# useVariablesEditor

`useVariablesEditor()` to wyższopoziomowy kompozyt domeny zmiennych do budowania okna dialogowego zmiennych lub ekranu edytora.

Łączy:

- stan okna dialogowego zmiennych
- kolumny tabeli zmiennych
- okablowanie TanStack Vue Table
- pomocniki kolekcji/trybu

## Użycie

```ts
const variables = useVariablesEditor({
  colorInput: ColorInput,
  icons,
  fallbackIcon,
  deleteIcon,
})
```

## Co zwraca

Zawiera stan niższego poziomu okna dialogowego/tabeli plus:

- `columns`
- `table`
- `hasCollections`

## Przykłady praktyczne

### Zbuduj okno dialogowe zmiennych

Użyj `useVariablesEditor()`, gdy chcesz jeden kompozyt, który już łączy tabelę i obsługę akcji razem.

## Powiązane API

- [Przegląd API SDK](../)
