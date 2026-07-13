---
title: BindableValue
description: Provider-driven value binding primitives for custom editor controls.
---

<script setup lang="ts">
import BindableValueDemo from '#vue/primitives/BindableValue/demo/BindableValueDemo.vue'
import { data } from './bindable-value.data'
</script>

# BindableValue

BindableValue composes variable or token binding with fields without coupling the field to a
specific editor store. Applications supply a `BindingProvider`; NumberField consumes the context
automatically when nested beneath `BindableValueRoot`.

<BindableValueDemo />

## Anatomy

- `BindableValueRoot` — binding state, policy, resolved value, picker state, and actions
- `BindableValueTrigger` — polymorphic bind-picker trigger
- `BindableValuePicker` — renderless Reka Combobox composition

## Policies

- `detach-on-edit` unbinds targets on the first value mutation and keeps the complete interaction
  in one provider undo batch.
- `readonly-when-bound` blocks field editing, scrubbing, and keyboard stepping.
- `edit-variable` sends changes to `provider.setValue()` instead of changing the target value.

Focusing a bound NumberField or opening its picker is non-destructive. The policy starts only when
the user types a changed draft, steps the value, or crosses the pointer-scrub threshold. Committing
an unchanged field creates no undo entry. Cancellation rolls back an open provider batch.
Providers without undo support still receive binding changes, with binding snapshots restored
where possible.

## Provider example

```ts twoslash
import type { BindingProvider, BindingTarget } from '@open-pencil/vue'

const values = new Map<string, number>([['spacing/md', 16]])
const bindings = new Map<string, string>()

const provider: BindingProvider<number> = {
  listVariables: () => [],
  filterVariables: () => [],
  getBound: () => undefined,
  getState: () => 'unbound',
  resolve: id => values.get(id),
  bind: (target: BindingTarget, variableId) => {
    bindings.set(`${target.nodeId}:${target.path}`, variableId)
  },
  unbind: (target: BindingTarget) => {
    bindings.delete(`${target.nodeId}:${target.path}`)
  }
}
```

## Generated API reference

The following tables are extracted from the Vue source and JSDoc during the documentation build.

<SdkComponentAPI :components="data.components" />
