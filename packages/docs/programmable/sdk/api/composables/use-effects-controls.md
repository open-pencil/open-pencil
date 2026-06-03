---
title: useEffectsControls
description: Effects-panel helpers for shadows, blurs, expansion state, and scrub/commit flows.
---

# useEffectsControls

`useEffectsControls()` is the effects-property composable used by effects panels.

It provides helpers for:

- default effects
- shadow vs blur logic
- expanded item state
- scrub-preview editing
- commit-on-finish updates
- effect type and color changes

## Usage

```ts
import { useEffectsControls } from '@inkly/vue'

const effects = useEffectsControls()
```

## Basic example

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()
```

## Practical examples

### Add a default effect

```ts
const effect = effects.createDefaultEffect()
```

### Preview scrub changes, then commit

```ts
effects.scrubEffect(node, index, { radius: 12 })
effects.commitEffect(node, index, { radius: 12 })
```

## Related APIs

- [PropertyListRoot](../components/property-list-root)
