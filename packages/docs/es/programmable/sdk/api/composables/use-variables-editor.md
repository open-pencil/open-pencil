---
title: useVariablesEditor
description: Combina el estado del diálogo de variables, las columnas de la tabla y el cableado de TanStack Table.
---

# useVariablesEditor

`useVariablesEditor()` es un composable de alto nivel del dominio de variables para construir un diálogo o pantalla de variables.

Combina:

- estado del diálogo de variables
- columnas de la tabla de variables
- cableado de TanStack Vue Table
- helpers de colección/modo

## Uso

```ts
const variables = useVariablesEditor({
  colorInput: ColorInput,
  icons,
  fallbackIcon,
  deleteIcon,
})
```

## Qué devuelve

Incluye el estado de diálogo/tabla de nivel inferior más:

- `columns`
- `table`
- `hasCollections`

## Ejemplos prácticos

### Construir un diálogo de variables

Usa `useVariablesEditor()` cuando quieras un solo composable que ya conecte la tabla y los manejadores de acciones.

## APIs relacionadas

- [Resumen de la API del SDK](../)
