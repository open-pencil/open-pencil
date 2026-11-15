---
title: useColorBindingProvider
description: OpenPencil COLOR variable provider for BindableValue fields.
---

# useColorBindingProvider

`useColorBindingProvider()` adapts OpenPencil COLOR variables to the generic `BindingProvider<Color>`
contract. It resolves current-mode colors, binds indexed paint paths, creates variables in a Colors
collection, updates all collection modes when requested, and exposes editor undo transactions.

Use it with `BindableValueRoot` and explicit targets such as `fills/0/color` or
`strokes/0/color`. Picker focus and opening remain non-destructive; the consumer chooses when an
actual color mutation begins and commits.

```ts twoslash
import type { Color } from '@open-pencil/scene-graph/primitives'
import { type BindingTarget, useColorBindingProvider } from '@open-pencil/vue/controls/binding-provider'

const provider = useColorBindingProvider()
const targets: BindingTarget[] = [
  { nodeId: 'rectangle-id', path: 'fills/0/color' }
]
const value: Color = { r: 0.2, g: 0.5, b: 0.9, a: 1 }

provider.getState(targets)
provider.resolve('variable-id')
```

The composable requires an editor provided by `provideEditor()`.

## Related APIs

- [BindableValue](../components/bindable-value)
- [FillSwatch](../components/fill-swatch)
- [useColorModel](../composables/use-color-model)
