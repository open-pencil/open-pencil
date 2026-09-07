<script setup lang="ts">
import { computed, normalizeClass, type HTMLAttributes } from 'vue'
import { documentEntry } from '@/theme/home/document-entry'

const {
  name,
  metadata,
  previewURL,
  view = 'grid',
  disabled = false,
  class: className,
  ui
} = defineProps<{
  name: string
  metadata: string
  previewURL?: string | null
  view?: 'grid' | 'list'
  disabled?: boolean
  class?: HTMLAttributes['class']
  ui?: Partial<
    Record<
      | 'root'
      | 'trigger'
      | 'preview'
      | 'image'
      | 'fallback'
      | 'icon'
      | 'body'
      | 'name'
      | 'metadata'
      | 'trailingMetadata'
      | 'actions',
      string
    >
  >
}>()
const emit = defineEmits<{ open: [] }>()
const styles = computed(() => documentEntry({ view }))
</script>

<template>
  <div
    data-slot="document-entry"
    :class="styles.root({ class: [ui?.root, normalizeClass(className)] })"
  >
    <button
      type="button"
      :disabled="disabled"
      data-slot="trigger"
      :class="styles.trigger({ class: ui?.trigger })"
      @click="emit('open')"
    >
      <span
        v-if="view === 'grid'"
        data-slot="preview"
        :class="styles.preview({ class: ui?.preview })"
      >
        <img
          v-if="previewURL"
          :src="previewURL"
          alt=""
          :class="styles.image({ class: ui?.image })"
        />
        <icon-lucide-file-image v-else :class="styles.fallback({ class: ui?.fallback })" />
      </span>
      <icon-lucide-file-image v-else :class="styles.icon({ class: ui?.icon })" />
      <span data-slot="body" :class="styles.body({ class: ui?.body })">
        <span data-slot="name" :class="styles.name({ class: ui?.name })">{{ name }}</span>
        <span data-slot="metadata" :class="styles.metadata({ class: ui?.metadata })">{{
          metadata
        }}</span>
      </span>
      <span
        v-if="view === 'list'"
        :class="styles.trailingMetadata({ class: ui?.trailingMetadata })"
        >{{ metadata }}</span
      >
    </button>
    <div v-if="$slots.actions" data-slot="actions" :class="styles.actions({ class: ui?.actions })">
      <slot name="actions" />
    </div>
  </div>
</template>
