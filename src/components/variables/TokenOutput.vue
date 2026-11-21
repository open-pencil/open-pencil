<script setup lang="ts">
import { computedAsync, useLocalStorage } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { TokenStylesheetFormat } from '@open-pencil/dom-css/export'
import { useEditor } from '@open-pencil/vue'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { variablesStylesheet } from '@/app/editor/tokens/stylesheet'
import CodeViewer from '@/components/code-editor/CodeViewer.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import outputTheme from '@/theme/variables/output'

const { collectionId, layout = 'side' } = defineProps<{
  collectionId: string
  /** `full` fills the panel behind a back button on narrow screens. */
  layout?: 'side' | 'full'
}>()
const emit = defineEmits<{ copy: [format: TokenStylesheetFormat]; export: [] }>()

const { variables } = useI18n()
/** Folded beside the list, the stylesheet shows its title alone; it stays folded across visits. */
const folded = useLocalStorage('open-pencil:stylesheet-folded', false)
const shownFolded = computed(() => layout === 'side' && folded.value)
const ui = computed(() => tv(outputTheme)({ layout, folded: shownFolded.value }))
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
  const { css } = await variablesStylesheet(editor.graph, {
    format: 'css',
    include: (variable) => ids.has(variable.id)
  })
  return css
}, '')
</script>

<template>
  <section :class="ui.root()" data-test-id="token-output">
    <div class="flex items-center gap-2 px-4 py-1.5">
      <button
        v-if="layout === 'side'"
        type="button"
        :class="[ui.title(), ui.toggle()]"
        :aria-expanded="!folded"
        data-test-id="variables-stylesheet-toggle"
        @click="folded = !folded"
      >
        <icon-lucide-chevron-right
          data-direction="reading"
          :class="ui.chevron()"
          :data-open="!folded || undefined"
        />
        {{ variables.stylesheet }}
      </button>
      <span class="flex-1" />
      <AppDropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <IconButton :label="variables.copyStylesheet" data-test-id="variables-copy-stylesheet">
            <icon-lucide-copy class="size-3.5" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent side="bottom" :side-offset="4" align="end" :class="menu.content">
            <MenuScrollArea>
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
              <DropdownMenuSeparator :class="menu.separator" />
              <DropdownMenuItem
                :class="menu.item"
                data-test-id="variables-export-tokens"
                @select="emit('export')"
              >
                <icon-lucide-file-archive :class="menu.icon" />
                {{ variables.exportDesignTokens }}
              </DropdownMenuItem>
            </MenuScrollArea>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </AppDropdownMenuRoot>
    </div>
    <CodeViewer
      v-if="!shownFolded"
      class="min-h-0 flex-1"
      :code="stylesheet"
      language="css"
      :label="variables.stylesheet"
      :fill="layout === 'full'"
    />
  </section>
</template>
