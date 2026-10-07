<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { TokenStylesheetFormat } from '@open-pencil/dom-css/export'
import { useEditor, useI18n, useSceneComputed } from '@open-pencil/vue'

import CodeViewer from '@/components/code-editor/CodeViewer.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import tokensPanelTheme from '@/theme/tokens-panel'

const { collectionId, layout = 'side' } = defineProps<{
  collectionId: string
  /** `full` fills the panel behind a back button on narrow screens. */
  layout?: 'side' | 'full'
}>()
const emit = defineEmits<{ copy: [format: TokenStylesheetFormat] }>()

const { variables } = useI18n()
const ui = computed(() => tv(tokensPanelTheme)({ layout }))
const menu = useMenuUI({ content: 'w-60', item: 'justify-start gap-2' })
const editor = useEditor()

/** A new list on every scene change, so the stylesheet follows edits. */
const collectionVariables = useSceneComputed(() => [
  ...editor.getVariablesForCollection(collectionId)
])

/**
 * The panel previews plain CSS; Tailwind's `@theme` holds the same declarations, so the format is
 * chosen where the stylesheet is copied rather than in a second view.
 */
const stylesheet = computedAsync(async () => {
  const ids = new Set(collectionVariables.value.map((variable) => variable.id))
  const { tokenStylesheet } = await import('@open-pencil/dom-css/export')
  const { css } = await tokenStylesheet(editor.graph, {
    format: 'css',
    include: (variable) => ids.has(variable.id)
  })
  return css
}, '')
</script>

<template>
  <section :class="ui.output()" data-test-id="token-output">
    <div class="flex items-center gap-2 px-4 py-1.5">
      <span v-if="layout === 'side'" :class="ui.sectionTitle()">{{ variables.stylesheet }}</span>
      <span class="flex-1" />
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <IconButton :label="variables.copyStylesheet" data-test-id="variables-copy-stylesheet">
            <icon-lucide-copy class="size-3.5" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent side="bottom" :side-offset="4" align="end" :class="menu.content">
            <DropdownMenuItem
              :class="menu.item"
              data-test-id="variables-copy-css"
              @select="emit('copy', 'css')"
            >
              <icon-lucide-braces :class="menu.icon" />
              {{ variables.copyAsCSS }}
            </DropdownMenuItem>
            <DropdownMenuItem
              :class="menu.item"
              data-test-id="variables-copy-tailwind"
              @select="emit('copy', 'tailwind')"
            >
              <icon-lucide-wind :class="menu.icon" />
              {{ variables.copyAsTailwindTheme }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
    <CodeViewer
      class="min-h-0 flex-1"
      :code="stylesheet"
      language="css"
      :label="variables.stylesheet"
      :fill="layout === 'full'"
    />
  </section>
</template>
