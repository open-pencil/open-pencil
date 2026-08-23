---
title: useVariablesEditor
description: Przygotowanie stanu okna zmiennych i TanStack Table.
---

# useVariablesEditor

`useVariablesEditor()` łączy stan okna, kolumny tabeli, integrację TanStack Vue Table oraz funkcje kolekcji i trybów.

```ts
const variables = useVariablesEditor({
  colorInput: ColorInput,
  icons,
  fallbackIcon,
  deleteIcon,
})
```

Wynik zawiera niskopoziomowy stan okna i tabeli oraz `columns`, `table` i `hasCollections`.

Użyj tego composable, gdy jeden punkt wejścia ma zapewniać integrację tabeli i obsługę działań.

## Zobacz też

- [Dokumentacja API](../)
