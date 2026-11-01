<script setup lang="ts">
import { computed } from 'vue'
import IconAlignCenterHorizontal from '~icons/lucide/align-center-horizontal'
import IconAlignCenterVertical from '~icons/lucide/align-center-vertical'
import IconAlignEndHorizontal from '~icons/lucide/align-end-horizontal'
import IconAlignEndVertical from '~icons/lucide/align-end-vertical'
import IconAlignStartHorizontal from '~icons/lucide/align-start-horizontal'
import IconAlignStartVertical from '~icons/lucide/align-start-vertical'

import { usePosition } from '@open-pencil/vue/controls/position'
import { useEditorCommands } from '@open-pencil/vue/editor/commands'
import { useI18n } from '@open-pencil/vue/i18n'

import { toolIcons } from '@/components/icons'
import IconButton from '@/components/ui/button/IconButton.vue'

import ToolbarMenu from './ToolbarMenu.vue'
import ToolbarOptions, { type ToolbarOption } from './ToolbarOptions.vue'

/** What FigJam's toolbar offers any several layers: aligning them, and wrapping them in a section. */
const position = usePosition()
const { getCommand, runCommand } = useEditorCommands()
const { panels } = useI18n()

type Alignment =
  | 'left'
  | 'centerX'
  | 'right'
  | 'top'
  | 'centerY'
  | 'bottom'
  | 'tidyUp'
  | 'distributeHorizontal'
  | 'distributeVertical'

const ALIGNMENTS = {
  left: ['horizontal', 'min'],
  centerX: ['horizontal', 'center'],
  right: ['horizontal', 'max'],
  top: ['vertical', 'min'],
  centerY: ['vertical', 'center'],
  bottom: ['vertical', 'max']
} as const

const options = computed<ToolbarOption<Alignment>[]>(() => [
  { value: 'left', label: panels.value.alignLeft, icon: IconAlignStartVertical },
  { value: 'centerX', label: panels.value.alignCenterHorizontally, icon: IconAlignCenterVertical },
  { value: 'right', label: panels.value.alignRight, icon: IconAlignEndVertical },
  { value: 'top', label: panels.value.alignTop, icon: IconAlignStartHorizontal },
  { value: 'centerY', label: panels.value.alignCenterVertically, icon: IconAlignCenterHorizontal },
  { value: 'bottom', label: panels.value.alignBottom, icon: IconAlignEndHorizontal },
  ...(['tidyUp', 'distributeHorizontal', 'distributeVertical'] as const).flatMap((id) => {
    const command = getCommand(`selection.${id}`)
    return command.enabled ? [{ value: id, label: command.label }] : []
  })
])

function align(value: Alignment) {
  if (value === 'tidyUp' || value === 'distributeHorizontal' || value === 'distributeVertical') {
    runCommand(`selection.${value}`)
    return
  }
  const [axis, to] = ALIGNMENTS[value]
  position.align(axis, to)
}
</script>

<template>
  <ToolbarMenu :label="panels.alignment" property="toolbar-alignment">
    <template #trigger>
      <icon-lucide-align-start-vertical class="size-4" />
    </template>
    <ToolbarOptions :label="panels.alignment" :options="options" :selected="null" @select="align" />
  </ToolbarMenu>
  <IconButton
    v-if="getCommand('selection.wrapInSection').enabled"
    size="md"
    :label="getCommand('selection.wrapInSection').label"
    data-property="toolbar-wrap-section"
    @click="runCommand('selection.wrapInSection')"
  >
    <component :is="toolIcons.SECTION" class="size-4" />
  </IconButton>
</template>
