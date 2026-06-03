---
title: useFillControls
description: Fill-panel composable with default fill behavior.
---

# useFillControls

`useFillControls()` is the fill-property composable used by fill editing UIs.

It adds a reusable default fill value.

## Usage

```ts
import { useFillControls } from '@inkly/vue'

const fills = useFillControls()
```

## What it gives you

It exposes:

- `defaultFill`

## Practical examples

### Add a new fill row

```ts
propertyList.add(fills.defaultFill)
```

## Related APIs

- [PropertyListRoot](../components/property-list-root)
