<script setup lang="ts">
import { defineComponent, KeepAlive, toRef } from 'vue'

import { provideRetainedActivity } from '@open-pencil/vue'

const { active } = defineProps<{ active: boolean }>()
provideRetainedActivity(toRef(() => active))

// One retained subtree per panel, released when its owning editor view unmounts.
const PanelBody = defineComponent({
  name: 'RetainedPanelBody',
  setup(_, { slots }) {
    return () => slots.default?.()
  }
})
</script>

<template>
  <KeepAlive :max="1">
    <PanelBody v-if="active">
      <slot />
    </PanelBody>
  </KeepAlive>
</template>
