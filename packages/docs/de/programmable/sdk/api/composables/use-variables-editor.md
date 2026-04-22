---
title: useVariablesEditor
description: Variablen-Dialog-Zustand, Tabellenspalten und TanStack-Tabellen-Verdrahtung zusammensetzen.
---

# useVariablesEditor

`useVariablesEditor()` ist ein übergeordnetes Variablen-Domänen-Composable zum Erstellen eines Variablen-Dialogs oder Variablen-Editor-Bildschirms.

Es kombiniert:

- Variablen-Dialog-Zustand
- Variablen-Tabellenspalten
- TanStack Vue Table-Verdrahtung
- Sammlungs-/Modus-Hilfsmittel

## Verwendung

```ts
const variables = useVariablesEditor({
  colorInput: ColorInput,
  icons,
  fallbackIcon,
  deleteIcon,
})
```

## Rückgabewerte

Es enthält den untergeordneten Dialog/Tabellen-Zustand sowie:

- `columns`
- `table`
- `hasCollections`

## Praktische Beispiele

### Einen Variablen-Dialog erstellen

Verwenden Sie `useVariablesEditor()`, wenn Sie ein einzelnes Composable möchten, das Tabelle und Aktionshandler bereits zusammenverdrahtet.

## Verwandte APIs

- [SDK API-Übersicht](../)
