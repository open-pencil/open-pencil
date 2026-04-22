---
title: useMenuModel
description: Construye modelos de menú de la app y del canvas a partir del estado actual del editor.
---

# useMenuModel

`useMenuModel()` construye estructuras de menú de alto nivel sobre los comandos del editor y el estado de la selección.

Es útil cuando quieres grupos de menú listos para renderizar en lugar de componer comandos manualmente.

## Uso

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Ejemplo básico

```ts
const { canvasMenu } = useMenuModel()
```

Renderiza `canvasMenu.value` en tu componente de menú contextual.

## Ejemplos prácticos

### Menú superior de estilo app

`appMenu` agrupa las entradas en:

- Editar
- Ver
- Objeto
- Organizar

### Menú contextual con movimiento de páginas

`canvasMenu` incluye elementos dinámicos como "Mover a página" según la selección actual y las páginas disponibles.

### Etiquetas de selección

`selectionLabelMenu` expone etiquetas sensibles al contexto como:

- `Ocultar` / `Mostrar`
- `Bloquear` / `Desbloquear`

## APIs relacionadas

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
