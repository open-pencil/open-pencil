---
title: useEffectsControls
description: Helper del pannello effetti per ombre, sfocature, stato di espansione e flussi scrub/commit.
---

# useEffectsControls

`useEffectsControls()` è il composable delle proprietà degli effetti usato dai pannelli degli effetti.

Fornisce helper per:

- effetti predefiniti
- logica per ombre vs sfocature
- stato degli elementi espansi
- modifica con anteprima scrub
- aggiornamenti con commit al completamento
- modifiche al tipo e al colore degli effetti

## Utilizzo

```ts
import { useEffectsControls } from '@open-pencil/vue'

const effects = useEffectsControls()
```

## Esempio base

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()
```

## Esempi pratici

### Aggiungi un effetto predefinito

```ts
const effect = effects.createDefaultEffect()
```

### Anteprima con scrub, poi commit

```ts
effects.scrubEffect(node, index, { radius: 12 })
effects.commitEffect(node, index, { radius: 12 })
```

## API correlate

- [PropertyListRoot](../components/property-list-root)
