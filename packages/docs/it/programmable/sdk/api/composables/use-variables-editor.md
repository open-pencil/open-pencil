---
title: useVariablesEditor
description: Compone lo stato del dialogo variabili, le colonne della tabella e il cablaggio della tabella TanStack.
---

# useVariablesEditor

`useVariablesEditor()` è un composable di livello superiore per il dominio delle variabili, utile per costruire un dialogo o una schermata di modifica delle variabili.

Combina:

- stato del dialogo variabili
- colonne della tabella variabili
- cablaggio di TanStack Vue Table
- helper per collezioni e modalità

## Utilizzo

```ts
const variables = useVariablesEditor({
  colorInput: ColorInput,
  icons,
  fallbackIcon,
  deleteIcon,
})
```

## Cosa restituisce

Include lo stato del dialogo/tabella di livello inferiore più:

- `columns`
- `table`
- `hasCollections`

## Esempi pratici

### Costruisci un dialogo variabili

Usa `useVariablesEditor()` quando vuoi un singolo composable che cabla già la tabella e gli handler delle azioni insieme.

## API correlate

- [Panoramica API SDK](../)
