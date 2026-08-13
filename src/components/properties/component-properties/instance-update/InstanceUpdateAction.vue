<script setup lang="ts">
import { toRef } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/session'
import type { LibraryService } from '@/app/libraries'
import { useInstanceUpdate } from '@/components/properties/component-properties/instance-update/use'
import Tip from '@/components/ui/Tip.vue'

const { node, editor, service } = defineProps<{
  node: SceneNode | null | undefined
  editor: EditorStore
  service: LibraryService
}>()
const emit = defineEmits<{ review: [] }>()
const { panels } = useI18n()
const { available, updating, updateSelectedInstance } = useInstanceUpdate(
  toRef(() => node),
  editor,
  service
)
</script>

<template>
  <div v-if="available" class="flex items-center gap-1" data-test-id="instance-update-action">
    <Tip :label="panels.updateSelectedInstance">
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50"
        :disabled="updating"
        :aria-label="panels.updateSelectedInstance"
        @click="updateSelectedInstance"
      >
        <icon-lucide-refresh-cw class="size-3.5" :class="updating ? 'animate-spin' : ''" />
      </button>
    </Tip>
    <button type="button" class="text-[10px] text-muted hover:text-surface" @click="emit('review')">
      {{ panels.reviewLibraryUpdate }}
    </button>
  </div>
</template>
