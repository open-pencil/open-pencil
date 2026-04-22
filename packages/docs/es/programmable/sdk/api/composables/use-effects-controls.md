---
title: useEffectsControls
description: Helpers del panel de efectos para sombras, desenfoque, estado de expansión y flujos de arrastre/confirmación.
---

# useEffectsControls

`useEffectsControls()` es el composable de propiedades de efectos usado por los paneles de efectos.

Proporciona helpers para:

- efectos por defecto
- lógica de sombra vs desenfoque
- estado de elementos expandidos
- edición mediante arrastre con vista previa
- actualizaciones de confirmación al terminar
- cambios de tipo de efecto y color

## Uso

```ts
import { useEffectsControls } from '@open-pencil/vue'

const effects = useEffectsControls()
```

## Ejemplo básico

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()
```

## Ejemplos prácticos

### Añadir un efecto por defecto

```ts
const effect = effects.createDefaultEffect()
```

### Previsualizar cambios con arrastre y luego confirmar

```ts
effects.scrubEffect(node, index, { radius: 12 })
effects.commitEffect(node, index, { radius: 12 })
```

## APIs relacionadas

- [PropertyListRoot](../components/property-list-root)
