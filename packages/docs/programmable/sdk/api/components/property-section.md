---
title: PropertySection
description: Headless collapsible anatomy for property-panel sections.
---

<script setup lang="ts">
import PropertySectionStates from '#vue/primitives/PropertySection/examples/States.vue'
import { data } from './property-section.data'
</script>

# PropertySection

PropertySection supplies collapsible section anatomy and canonical open, empty, and disabled state
attributes without imposing presentation.

<PropertySectionStates />

## Anatomy

- `PropertySectionRoot` — controlled or uncontrolled Collapsible state
- `PropertySectionHeader` — structural header container
- `PropertySectionTitle` — accessible Collapsible trigger
- `PropertySectionActions` — sibling action area, avoiding nested buttons
- `PropertySectionContent` — collapsible content region
- `PropertySectionEmptyAction` — empty-only action that opens before emitting `activate`

```vue twoslash
<script setup lang="ts">
import {
  PropertySectionContent,
  PropertySectionHeader,
  PropertySectionRoot,
  PropertySectionTitle
} from '@open-pencil/vue'
</script>

<template>
  <PropertySectionRoot default-open>
    <PropertySectionHeader>
      <PropertySectionTitle>Layout</PropertySectionTitle>
    </PropertySectionHeader>
    <PropertySectionContent>Panel fields</PropertySectionContent>
  </PropertySectionRoot>
</template>
```

## Generated API reference

<SdkComponentAPI :components="data.components" />
