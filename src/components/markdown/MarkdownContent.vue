<script setup lang="ts">
import { computed } from 'vue'
import { Markdown } from 'vue-stream-markdown'

import { IS_BROWSER } from '@open-pencil/core/constants'

import { createMarkdownHardenOptions, markdownExtensions } from '@/app/shell/markdown/config'
import { animationsEnabled } from '@/app/shell/motion'
import { resolvedAppTheme } from '@/app/shell/theme'
import InlineCode from '@/components/markdown/InlineCode.vue'
import MarkdownTooltip from '@/components/markdown/MarkdownTooltip.vue'
import { markdownTheme, type MarkdownDensity } from '@/theme/markdown'

const {
  content,
  mode = 'static',
  density = 'compact',
  highlightCode = false,
  class: className
} = defineProps<{
  content: string
  mode?: 'static' | 'streaming'
  density?: MarkdownDensity
  /** Loads Shiki for fenced code blocks; leave off where code is rare. */
  highlightCode?: boolean
  class?: string
}>()

const isDark = computed(() => resolvedAppTheme.value === 'dark')
const ui = markdownTheme()
const markdownComponents = { code: InlineCode }
// The renderer's own tooltip doubles up with ours and does not follow the app's style.
const uiComponents = { Tooltip: MarkdownTooltip }
// Copy is the one table action that fits a chat reply; images open in the attachment viewer.
const controls = {
  code: { download: false, fullscreen: false },
  table: { copy: true, download: false, fullscreen: false },
  image: false
}
// Favicons would request `/favicon.ico` from every site a reply links to.
const linkOptions = { favicon: false }
const extensions = computed(() => (highlightCode ? markdownExtensions : undefined))
const hardenOptions = computed(() =>
  createMarkdownHardenOptions(IS_BROWSER ? window.location.origin : 'http://localhost/')
)
</script>

<template>
  <div data-slot="markdown" :class="ui.root({ class: className })">
    <Markdown
      :components="markdownComponents"
      :content="content"
      :is-dark="isDark"
      :enable-animate="animationsEnabled"
      :mode="mode"
      :extensions="extensions"
      :harden-options="hardenOptions"
      :previewers="false"
      :controls="controls"
      :link-options="linkOptions"
      :ui-components="uiComponents"
      :data-markdown-mode="mode"
      :data-markdown-density="density"
      :class="ui.markdown()"
    />
  </div>
</template>
