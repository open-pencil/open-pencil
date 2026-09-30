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
  <div
    role="button"
    tabindex="0"
    :data-issue-id="row.issue.id"
    :data-node-id="row.issue.nodeId"
    :data-selected="row.selected ? '' : undefined"
    :data-missing="row.missing ? '' : undefined"
    :aria-current="row.selected ? 'true' : undefined"
    :class="styles.row()"
    @click="emit('open')"
    @keydown.enter.prevent="emit('open')"
    @keydown.space.prevent="emit('open')"
    @mouseenter="emit('hover', true)"
    @mouseleave="emit('hover', false)"
    @focus="emit('hover', true)"
    @blur="emit('hover', false)"
  >
    <component :is="row.layerIcon" :class="styles.rowIcon()" aria-hidden="true" />
    <span :class="styles.rowName()">{{ row.missing ? messages.missingLayer : row.layerName }}</span>
    <span v-if="row.hidden" :class="styles.rowTag()">{{ messages.hiddenLayer }}</span>
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
    <Tip
      v-if="row.fix && !row.missing"
      as-child
      :label="messages.bindVariable({ variable: row.fix.variableName })"
    >
      <button
        type="button"
        data-slot="issue-fix"
        :class="styles.rowAction()"
        @click.stop="emit('fix')"
        @keydown.enter.stop
        @keydown.space.stop
      >
        <icon-lucide-link class="size-3" aria-hidden="true" />
        <span class="sr-only">{{ messages.bindVariable({ variable: row.fix.variableName }) }}</span>
      </button>
    </Tip>
  </div>
</template>
