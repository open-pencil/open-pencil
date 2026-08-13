<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { toRef } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/session'
import type { LibraryService } from '@/app/libraries'
import { useInstanceUpdate } from '@/components/properties/component-properties/instance-update/use'
import Tip from '@/components/ui/Tip.vue'
import { useMenuUI } from '@/components/ui/menu'

const { node, editor, service } = defineProps<{
  node: SceneNode | null | undefined
  editor: EditorStore
  service: LibraryService
}>()
const emit = defineEmits<{ review: [] }>()
const { panels } = useI18n()
const menu = useMenuUI({ content: 'min-w-48' })
const { available, updating, updateSelectedInstance } = useInstanceUpdate(
  toRef(() => node),
  editor,
  service
)
</script>

<template>
  <DropdownMenuRoot v-if="available">
    <Tip :label="panels.updateSelectedInstance">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          data-test-id="instance-update-action"
          class="flex size-7 items-center justify-center rounded bg-accent/10 text-accent hover:bg-accent/20 data-[state=open]:bg-accent/20 disabled:opacity-50"
          :disabled="updating"
          :aria-label="panels.updateSelectedInstance"
        >
          <icon-lucide-refresh-cw class="size-3.5" :class="updating ? 'animate-spin' : ''" />
        </button>
      </DropdownMenuTrigger>
    </Tip>
    <DropdownMenuPortal>
      <DropdownMenuContent align="end" side="bottom" :side-offset="4" :class="menu.content">
        <DropdownMenuItem
          data-test-id="instance-update-selected"
          :class="menu.item"
          :disabled="updating"
          @select="updateSelectedInstance"
        >
          {{ panels.updateSelectedInstance }}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-test-id="instance-review-update"
          :class="menu.item"
          @select="emit('review')"
        >
          {{ panels.reviewLibraryUpdate }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
