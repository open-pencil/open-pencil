---
title: useVariablesTable
description: TanStack Table-Spaltendefinitionen für Inkly-Variablen-UIs erstellen.
---

# useVariablesTable

`useVariablesTable(options)` gibt reaktive TanStack Table-Spaltendefinitionen für Variablen-Editoren zurück.

Verwenden Sie es, wenn Sie das SDK-Variablen-Tabellen-Verhalten möchten, aber Ihre eigene Tabelleninstanz, benutzerdefinierte Symbole oder app-spezifische Shell-Komponenten bereitstellen müssen.

## Verwendung

```ts
import { useVariablesTable } from '@inkly/vue'

const { columns } = useVariablesTable(options)
```

## Hinweise

- dies ist ein spezialisiertes Integrations-Hilfsmittel für tabellengesteuerte Variablen-UIs
- die meisten Nutzer sollten mit `useVariablesEditor()` beginnen, außer sie benötigen feinere Kontrolle

## Verwandte APIs

- [useVariablesEditor](../composables/use-variables-editor)
- [useVariables](./use-variables)
- [useVariablesDialogState](./use-variables-dialog-state)
