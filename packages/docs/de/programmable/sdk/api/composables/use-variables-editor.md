---
title: useVariablesEditor
description: Zustand eines Variablendialogs und TanStack Table vorbereiten.
---

# useVariablesEditor

`useVariablesEditor()` verbindet Dialogzustand, Tabellenspalten, TanStack Vue Table und Funktionen für Sammlungen und Modi.

```ts
const variables = useVariablesEditor({
  colorInput: ColorInput,
  icons,
  fallbackIcon,
  deleteIcon,
})
```

Das Ergebnis enthält den Zustand von Dialog und Tabelle sowie `columns`, `table` und `hasCollections`.

## Siehe auch

- [API-Übersicht](../)
