<script setup lang="ts">
import { useDesignCheckMessages } from '@open-pencil/vue'

import Tip from '@/components/ui/overlay/Tip.vue'
import { designCheck } from '@/theme/design-check'

import type { IssueRowView } from './types'

const { row } = defineProps<{ row: IssueRowView }>()
const emit = defineEmits<{
  open: []
  hover: [hovered: boolean]
  fix: []
}>()

const messages = useDesignCheckMessages()
const styles = designCheck()
</script>

<template>
  <!-- The row and its fix are sibling buttons: interactive controls must not nest. -->
  <li
    :class="styles.rowItem()"
    @mouseenter="emit('hover', true)"
    @mouseleave="emit('hover', false)"
    @focusin="emit('hover', true)"
    @focusout="emit('hover', false)"
  >
    <button
      type="button"
      :data-issue-id="row.issue.id"
      :data-node-id="row.issue.nodeId"
      :data-selected="row.selected ? '' : undefined"
      :data-missing="row.missing ? '' : undefined"
      :aria-current="row.selected ? 'true' : undefined"
      :class="styles.row()"
      @click="emit('open')"
    >
      <component :is="row.layerIcon" :class="styles.rowIcon()" aria-hidden="true" />
      <span :class="styles.rowName()">{{
        row.missing ? messages.missingLayer : row.layerName
      }}</span>
      <span v-if="row.hidden" :class="styles.rowTag()">{{ messages.hiddenLayer }}</span>
      <span v-if="row.pageLabel" :class="styles.rowTag()" data-slot="page">{{
        row.pageLabel
      }}</span>
      <span v-if="row.detail" :class="styles.rowDetail()">
        <span
          v-if="row.swatch?.kind === 'color'"
          :class="styles.swatch()"
          :style="{ backgroundColor: row.swatch.color }"
          aria-hidden="true"
        />
        <span
          v-else-if="row.swatch?.kind === 'contrast'"
          :class="styles.contrastSwatch()"
          :style="{ backgroundColor: row.swatch.background, color: row.swatch.foreground }"
          aria-hidden="true"
        >
          Aa
        </span>
        <span :class="styles.rowDetailText()">{{ row.detail }}</span>
      </span>
    </button>
    <Tip v-if="row.action" as-child :label="row.action.label">
      <button
        type="button"
        :aria-label="row.action.label"
        :class="styles.rowAction()"
        @click="emit('fix')"
      >
        <icon-lucide-link
          v-if="row.action.kind === 'bind-variable'"
          class="size-3"
          aria-hidden="true"
        />
        <icon-lucide-wand-sparkles v-else class="size-3" aria-hidden="true" />
      </button>
    </Tip>
  </li>
</template>
