---
title: NumberField
description: Headless numeric field primitives with scrubbing, expressions, and keyboard stepping.
---

<script setup lang="ts">
import NumberFieldDemo from '#vue/primitives/NumberField/demo/NumberFieldDemo.vue'
import { data } from './number-field.data'
</script>

# NumberField

The NumberField family provides a headless numeric control with pointer scrubbing, mixed values,
keyboard stepping, safe arithmetic expressions, units, trailing actions, and binding-aware state.

<NumberFieldDemo />

## Anatomy

- `NumberFieldRoot` — renderless state and interaction owner
- `NumberFieldLeading` — leading label or icon
- `NumberFieldValue` — non-editing value
- `NumberFieldInput` — editing input with spinbutton semantics
- `NumberFieldUnit` — unit text
- `NumberFieldTrailing` — trailing action area
- `NumberFieldMenu` — field menu area

## Root slot

The default slot receives `modelValue`, `displayValue`, `draftValue`, `placeholder`, all state
booleans, `state`, `actions`, and `attrs`. Bind `attrs` to the focusable outer element. It contains
the canonical spinbutton ARIA contract, keyboard/focus handlers, and `data-editing`,
`data-scrubbing`, `data-mixed`, `data-disabled`, and `data-bound` attributes.

## Expressions and keyboard

Committed input accepts absolute arithmetic such as `12*8+4`, relative operations such as
`+10`, `-4`, `*2`, and `/3`, and percentages such as `50%` when `max` is finite. The parser only
accepts numbers, parentheses, and `+ - * /`; it never evaluates JavaScript.

Arrow keys step by `step`. Shift multiplies the step by 10 and Alt multiplies it by 0.1. Enter
commits and Escape restores the interaction-start value.

## Example

```vue twoslash
<script setup lang="ts">
import { ref } from 'vue'
import {
  NumberFieldInput,
  NumberFieldLeading,
  NumberFieldRoot,
  NumberFieldUnit,
  NumberFieldValue
} from '@open-pencil/vue'

const width = ref(120)
//    ^?
</script>

<template>
  <NumberFieldRoot
    v-slot="{ attrs, editing, actions }"
    v-model="width"
    :min="0"
    :max="1000"
    aria-label="Width"
  >
    <div v-bind="attrs" @pointerdown="!editing && actions.startScrub($event)">
      <NumberFieldLeading>W</NumberFieldLeading>
      <NumberFieldInput />
      <NumberFieldValue />
      <NumberFieldUnit>px</NumberFieldUnit>
    </div>
  </NumberFieldRoot>
</template>
```

## Generated API reference

The following tables are extracted from the Vue source and its JSDoc during the documentation build.

<SdkComponentAPI :components="data.components" />
