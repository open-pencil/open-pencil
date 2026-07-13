---
title: SegmentedControl
description: Accessible selection and action-only segmented controls.
---

<script setup lang="ts">
import { data } from './segmented-control.data'
</script>

# SegmentedControl

SegmentedControl delegates selection, roving focus, and keyboard behavior to Reka UI. Single and
multiple modes retain selection; action mode emits commands without toggle state.

## Selection mode

```vue twoslash
<script setup lang="ts">
import { ref } from 'vue'
import { SegmentedControlItem, SegmentedControlRoot } from '@open-pencil/vue'

const alignment = ref('left')
</script>

<template>
  <SegmentedControlRoot v-model="alignment" aria-label="Alignment">
    <SegmentedControlItem value="left">Left</SegmentedControlItem>
    <SegmentedControlItem value="center">Center</SegmentedControlItem>
    <SegmentedControlItem value="right">Right</SegmentedControlItem>
  </SegmentedControlRoot>
</template>
```

## Action mode

Use `mode="action"` for grouped commands such as flip and rotate. Arrow keys move focus, while
Space or Enter emits `action(value)` without leaving a selected segment.

The complete state matrix is shown in the [PropertySection demo](./property-section).

## Generated API reference

<SdkComponentAPI :components="data.components" />
