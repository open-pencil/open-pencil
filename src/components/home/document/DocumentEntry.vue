<script setup lang="ts">
import { computed, normalizeClass, type HTMLAttributes } from 'vue'

import { documentEntry } from '@/theme/home/document-entry'

const {
  name,
  metadata,
  previewURL,
  view = 'grid',
  disabled = false,
  class: className
} = defineProps<{
  name: string
  metadata: string
  previewURL?: string | null
  view?: 'grid' | 'list'
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()
const emit = defineEmits<{ open: [] }>()
const styles = computed(() => documentEntry({ view }))
</script>

<template>
  <div data-slot="document-entry" :class="styles.root({ class: normalizeClass(className) })">
    <button
      type="button"
      :disabled="disabled"
      data-slot="trigger"
      :class="styles.trigger()"
      @click="emit('open')"
    >
      <span v-if="view === 'grid'" data-slot="preview" :class="styles.preview()">
        <img v-if="previewURL" :src="previewURL" alt="" :class="styles.image()" />
        <icon-lucide-file-image v-else :class="styles.fallback()" />
      </span>
      <icon-lucide-file-image v-else :class="styles.icon()" />
      <span data-slot="body" :class="styles.body()">
        <span data-slot="name" :class="styles.name()">{{ name }}</span>
        <span data-slot="metadata" :class="styles.metadata()">{{ metadata }}</span>
      </span>
      <span v-if="view === 'list'" :class="styles.trailingMetadata()">{{ metadata }}</span>
    </button>
    <div v-if="$slots.actions" data-slot="actions" :class="styles.actions()">
      <slot name="actions" />
    </div>
  </div>
</template>
