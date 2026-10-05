<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref } from 'vue'

import type { TokenStylesheetFormat } from '@open-pencil/dom-css/export'
import { useEditor, useI18n, useSceneComputed } from '@open-pencil/vue'

import CodeViewer from '@/components/code-editor/CodeViewer.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { swapTransition } from '@/theme/motion/styles'
import tokensPanelTheme from '@/theme/tokens-panel'

const { collectionId, layout = 'side' } = defineProps<{
  collectionId: string
  /** `full` fills the panel behind a back button on narrow screens. */
  layout?: 'side' | 'full'
}>()
const emit = defineEmits<{ copy: [format: TokenStylesheetFormat] }>()

const { variables } = useI18n()
const ui = computed(() => tv(tokensPanelTheme)({ layout }))
const editor = useEditor()
const format = ref<TokenStylesheetFormat>('css')
const formats = [
  { value: 'css', label: 'CSS' },
  { value: 'tailwind', label: 'Tailwind' }
]

/** A new list on every scene change, so the stylesheet follows edits. */
const collectionVariables = useSceneComputed(() => [
  ...editor.getVariablesForCollection(collectionId)
])

const stylesheet = computedAsync(async () => {
  const ids = new Set(collectionVariables.value.map((variable) => variable.id))
  const { tokenStylesheet } = await import('@open-pencil/dom-css/export')
  const { css } = await tokenStylesheet(editor.graph, {
    format: format.value,
    include: (variable) => ids.has(variable.id)
  })
  return css
}, '')

function setFormat(value: string) {
  if (value === 'css' || value === 'tailwind') format.value = value
}
</script>

<template>
  <section :class="ui.output()" data-test-id="token-output">
    <div class="flex items-center gap-2 px-4 py-1.5">
      <span v-if="layout === 'side'" class="text-[11px] font-semibold text-muted">
        {{ variables.stylesheet }}
      </span>
      <SegmentedControl
        :model-value="format"
        :options="formats"
        :label="variables.stylesheet"
        @update:model-value="setFormat"
      />
      <span class="flex-1" />
      <IconButton
        :label="format === 'css' ? variables.copyAsCSS : variables.copyAsTailwindTheme"
        @click="emit('copy', format)"
      >
        <icon-lucide-copy class="size-3.5" />
      </IconButton>
    </div>
    <Transition v-bind="swapTransition" mode="out-in">
      <CodeViewer
        :key="format"
        class="min-h-0 flex-1"
        :code="stylesheet"
        language="css"
        :label="variables.stylesheet"
        :fill="layout === 'full'"
      />
    </Transition>
  </section>
</template>
