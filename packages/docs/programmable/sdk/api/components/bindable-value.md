---
title: BindableValue
description: Provider-driven value binding primitives for custom editor controls.
---

<script setup lang="ts">
import BindableValueStates from '#vue/primitives/BindableValue/examples/States.vue'
import { data } from './bindable-value.data'
</script>

# BindableValue

BindableValue composes variable or token binding with fields without coupling the field to a
specific editor store. Applications supply a `BindingProvider`; NumberField consumes the context
automatically when nested beneath `BindableValueRoot`.

<BindableValueStates />

## Anatomy

- `BindableValueRoot` — binding state, policy, resolved value, picker state, and actions
- `BindableValueTrigger` — polymorphic bind-picker trigger
- `BindableValuePicker` — renderless Reka Combobox composition

## Policies

- `detach-on-edit` unbinds targets on the first value mutation and keeps the complete interaction
  in one provider undo batch.
- `readonly-when-bound` blocks field editing, scrubbing, and keyboard stepping.
- `edit-variable` uses `provider.prepareEdit()` to capture a stable edit key, current value, setter, and restoration callback instead of changing the target value.

Focusing a bound NumberField or opening its picker is non-destructive. The policy starts only when
the user types a changed draft, steps the value, or crosses the pointer-scrub threshold. Committing
an unchanged field creates no undo entry. Cancellation rolls back an open provider batch.
Providers without undo support still receive binding changes, with binding snapshots restored
where possible.

## Provider example

```ts twoslash
import type { Variable } from '@open-pencil/scene-graph'
import type { BindingProvider, BindingTarget } from '@open-pencil/vue'

const variable: Variable = {
  id: 'spacing/md', name: 'Spacing / Medium', type: 'FLOAT',
  collectionId: 'spacing', valuesByMode: { default: 16 },
  description: '', hiddenFromPublishing: false
}
const values = new Map<string, number>([[variable.id, 16]])
const bindings = new Map<string, string>()
const getBindingId = (target: BindingTarget) => bindings.get(`${target.nodeId}:${target.path}`)
const resolve: BindingProvider<number>['resolve'] = id => values.get(id)

const provider: BindingProvider<number> = {
  listVariables: () => [variable],
  filterVariables: term => variable.name.toLowerCase().includes(term.toLowerCase()) ? [variable] : [],
  getBindingId,
  getBound: target => getBindingId(target) === variable.id ? variable : undefined,
  getState: targets => {
    const ids = new Set(targets.map(getBindingId))
    if (ids.size === 0 || (ids.size === 1 && ids.has(undefined))) return 'unbound'
    if (ids.size > 1) return 'mixed'
    if (!ids.has(variable.id)) return 'unresolved'
    const resolved = targets.map(target => resolve(variable.id, target))
    if (resolved.some(value => value === undefined)) return 'unresolved'
    return new Set(resolved).size > 1 ? 'mixed' : 'bound'
  },
  resolve,
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
