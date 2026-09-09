<script setup lang="ts">
import { TabsContent } from 'reka-ui'
import { normalizeClass, type HTMLAttributes } from 'vue'

import { tabs } from '@/theme/tabs/tabs'

// Inactive panels unmount, matching settings' previous v-if lifecycle.
// In particular, credentials must not be retained by force-mounting hidden forms.
const {
  value,
  asChild = false,
  class: className,
  ui
} = defineProps<{
  value: string
  asChild?: boolean
  class?: HTMLAttributes['class']
  ui?: { content?: string }
}>()
const styles = tabs()
</script>

<template>
  <TabsContent
    :value="value"
    :as-child="asChild"
    data-slot="content"
    :class="styles.content({ class: [ui?.content, normalizeClass(className)] })"
  >
    <slot />
  </TabsContent>
</template>
