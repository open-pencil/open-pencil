<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { computed } from 'vue'

import type { PlacedStatusLabel } from '@open-pencil/core/canvas'
import { useStatusMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { openStatusesDialog } from '@/app/editor/statuses/dialog'
import { useSelectedStatuses } from '@/app/editor/statuses/selection'
import StatusDot from '@/components/statuses/StatusDot.vue'
import { menu } from '@/components/ui/menu/menu'

/**
 * The menu a status pill or dot on the canvas opens, beside it: the document's states and Remove.
 * Clicking the label selects its layer first, so the menu acts on the selection as the panel does.
 */
const { label, canvas } = defineProps<{
  label: PlacedStatusLabel | null
  canvas: HTMLElement | null
}>()
const emit = defineEmits<{ close: [] }>()

const store = useEditorStore()
const messages = useStatusMessages()
const { workflow, stateId, setState, remove } = useSelectedStatuses()
const styles = menu({ tone: 'default' })

const reference = computed(() => {
  const current = label
  const element = canvas
  if (!current || !element) return null
  return {
    getBoundingClientRect() {
      const bounds = element.getBoundingClientRect()
      const { rect } = current
      return new DOMRect(bounds.left + rect.x, bounds.top + rect.y, rect.width, rect.height)
    }
  }
})

function choose(id: string) {
  setState(id)
  emit('close')
}

function editStatuses() {
  openStatusesDialog(store)
  emit('close')
}

function clear() {
  remove()
  emit('close')
}
</script>

<template>
  <PopoverRoot :open="!!reference" @update:open="(open) => !open && emit('close')">
    <PopoverPortal>
      <PopoverContent
        v-if="reference"
        :reference="reference"
        side="bottom"
        align="start"
        :side-offset="4"
        :collision-padding="8"
        :class="[styles.content(), 'min-w-44']"
        data-test-id="status-label-menu"
        @open-auto-focus.prevent
      >
        <p :class="styles.label()">{{ messages.status }}</p>
        <button
          v-for="state in workflow.states"
          :key="state.id"
          type="button"
          :class="styles.item()"
          :data-current="stateId === state.id || undefined"
          @click="choose(state.id)"
        >
          <StatusDot :color="state.color" />
          <span class="flex-1 text-left">{{ state.name }}</span>
          <icon-lucide-check v-if="stateId === state.id" :class="styles.icon()" />
        </button>
        <div :class="styles.separator()" />
        <button type="button" :class="styles.item()" @click="clear">
          {{ messages.removeStatus }}
        </button>
        <button type="button" :class="styles.item()" @click="editStatuses">
          {{ messages.editStatuses }}
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
