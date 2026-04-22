---
title: useEffectsControls
description: Pomocniki panelu efektów dla cieni, rozmyć, stanu rozwinięcia i przepływów przeciągania/zatwierdzania.
---

# useEffectsControls

`useEffectsControls()` to kompozyt właściwości efektów używany przez panele efektów.

Udostępnia pomocniki dla:

- domyślnych efektów
- logiki cieni vs rozmyć
- stanu rozwinięcia elementów
- edycji z podglądem przeciągania
- aktualizacji z zatwierdzaniem po zakończeniu
- zmiany typu efektu i koloru

## Użycie

```ts
import { useEffectsControls } from '@open-pencil/vue'

const effects = useEffectsControls()
```

## Podstawowy przykład

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()
```

## Przykłady praktyczne

### Dodaj domyślny efekt

```ts
const effect = effects.createDefaultEffect()
```

### Podgląd zmian przeciągania, następnie zatwierdź

```ts
effects.scrubEffect(node, index, { radius: 12 })
effects.commitEffect(node, index, { radius: 12 })
```

## Powiązane API

- [PropertyListRoot](../components/property-list-root)
