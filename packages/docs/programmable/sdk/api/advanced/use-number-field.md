---
title: useNumberField
description: Context helper for custom NumberField descendants.
---

# useNumberField

`useNumberField()` reads the context provided by `NumberFieldRoot`. Use it inside custom field
parts that need the canonical value, draft, state attributes, ARIA attributes, or actions.

It throws when called outside a `NumberFieldRoot` subtree.

```ts
import { useNumberField } from '@open-pencil/vue'

const field = useNumberField()
field.actions.startEdit()
```

See [NumberField](../components/number-field) for the complete context and anatomy.
