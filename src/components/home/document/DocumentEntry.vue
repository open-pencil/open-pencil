<script setup lang="ts">
import { computed, normalizeClass, useTemplateRef, watch, type HTMLAttributes } from 'vue'

import { useInlineRename } from '@open-pencil/vue'

import { documentEntry } from '@/theme/home/document-entry'

const {
  name,
  metadata,
  previewURL,
  view = 'grid',
  disabled = false,
  renaming = false,
  class: className
} = defineProps<{
  name: string
  metadata: string
  previewURL?: string | null
  view?: 'grid' | 'list'
  disabled?: boolean
  /** The name is an inline field, as when Figma renames a file in Recents. */
  renaming?: boolean
  class?: HTMLAttributes['class']
}>()
const emit = defineEmits<{ open: []; rename: [name: string]; 'rename-end': [] }>()
const styles = computed(() => documentEntry({ view }))

const rename = useInlineRename<'name'>((_, value) => emit('rename', value))
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
watch(
  () => renaming,
  (active) => {
    if (active) rename.start('name', name)
  },
  { immediate: true }
)
watch(nameInput, (input) => void rename.focusInput(input), { flush: 'post' })
watch(rename.editingId, (id) => {
  if (id === null && renaming) emit('rename-end')
})
</script>

<template>
  <div data-slot="document-entry" :class="styles.root({ class: normalizeClass(className) })">
    <component
      :is="renaming ? 'div' : 'button'"
      :type="renaming ? undefined : 'button'"
      :disabled="renaming ? undefined : disabled"
      data-slot="trigger"
      :class="styles.trigger()"
      @click="renaming || emit('open')"
    >
      <span v-if="view === 'grid'" data-slot="preview" :class="styles.preview()">
        <img v-if="previewURL" :src="previewURL" alt="" :class="styles.image()" />
        <icon-lucide-file-image v-else :class="styles.fallback()" />
      </span>
      <icon-lucide-file-image v-else :class="styles.icon()" />
      <span data-slot="body" :class="styles.body()">
        <input
          v-if="renaming"
          ref="nameInput"
          :value="name"
          data-slot="name-input"
          data-test-id="home-design-rename"
          :aria-label="name"
          :class="styles.nameInput()"
          @blur="rename.commit('name', $event)"
          @keydown.stop="rename.onKeydown"
        />
        <span v-else data-slot="name" :class="styles.name()">{{ name }}</span>
        <span data-slot="metadata" :class="styles.metadata()">{{ metadata }}</span>
      </span>
      <span v-if="view === 'list'" :class="styles.trailingMetadata()">{{ metadata }}</span>
    </component>
    <div v-if="$slots.actions" data-slot="actions" :class="styles.actions()">
      <slot name="actions" />
    </div>
  </div>
</template>
