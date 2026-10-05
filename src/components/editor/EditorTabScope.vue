<script setup lang="ts">
import { provideEditor } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/active-store'

const { store } = defineProps<{ store: EditorStore }>()

// The editor UI of one tab stays bound to that tab's document. The app-level editor follows the
// active tab, and handing it to these components would move their subscriptions to the next
// document when this tab closes.
provideEditor(store)
</script>

<template>
  <slot />
</template>
