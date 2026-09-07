<script setup lang="ts">
import { normalizeClass, type HTMLAttributes } from 'vue'
import { TabsContent } from 'reka-ui'
import { tabs } from '@/theme/tabs/tabs'

// Inactive panels unmount, matching settings' previous v-if lifecycle.
// In particular, credentials must not be retained by force-mounting hidden forms.
const {
  value,
  class: className,
  ui
} = defineProps<{ value: string; class?: HTMLAttributes['class']; ui?: { content?: string } }>()
const styles = tabs()
</script>

<template>
  <TabsContent
    :value="value"
    data-slot="content"
    :class="styles.content({ class: [ui?.content, normalizeClass(className)] })"
  >
    <slot />
  </TabsContent>
</template>
