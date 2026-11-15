<script setup lang="ts">
import type { MarkdownDocument } from 'comark'
import { tv } from 'tailwind-variants'
import { computed, provide, shallowRef, watch, type Component } from 'vue'

import { animateWords } from '@/app/shell/markdown/animate'
import { createMarkdownParser, type MarkdownParser } from '@/app/shell/markdown/config'
import { animationsEnabled } from '@/app/shell/motion'
import theme, { type MarkdownDensity } from '@/theme/markdown'

import { MARKDOWN_ANIMATING } from './context'
import { AppMarkdownDocument } from './document'

const markdownTheme = tv(theme)

const {
  content,
  mode = 'static',
  density = 'compact',
  highlightCode = false,
  components,
  class: className
} = defineProps<{
  content: string
  mode?: 'static' | 'streaming'
  density?: MarkdownDensity
  /** Loads Shiki for fenced code blocks; leave off where code is rare. */
  highlightCode?: boolean
  /** Inline components the content uses, written `:name[text]{attributes}`. */
  components?: Record<string, Component>
  class?: string
}>()

const ui = markdownTheme()
const streaming = computed(() => mode === 'streaming')
const animating = computed(() => streaming.value && animationsEnabled.value)
provide(MARKDOWN_ANIMATING, animating)

const parsed = shallowRef<MarkdownDocument | null>(null)
let parser: Promise<MarkdownParser> | undefined
let parserHighlights = highlightCode

watch(
  () => [content, streaming.value, highlightCode] as const,
  async ([text, isStreaming, highlight]) => {
    if (!parser || parserHighlights !== highlight) {
      parser = createMarkdownParser(highlight)
      parserHighlights = highlight
    }
    const parse = await parser
    parsed.value = await parse(text, { streaming: isStreaming })
  },
  { immediate: true }
)

/**
 * While a reply streams, each word is its own element, so only new words fade in. Comark draws
 * a caret but no entry animation, and its plugins cannot tell a streaming parse from the final
 * one, so the words are split here, on the parsed document, before it renders.
 */
const document = computed(() => {
  const value = parsed.value
  if (!value || !animating.value) return value
  return { ...value, nodes: animateWords(value.nodes) }
})
</script>

<template>
  <div data-slot="markdown" :class="ui.root({ class: className })">
    <!-- Comark's renderers are async components and render inside a Suspense. -->
    <Suspense>
      <AppMarkdownDocument
        v-if="document"
        :value="document"
        :components="components"
        :streaming="streaming"
        :class="ui.markdown()"
        :data-markdown-mode="mode"
        :data-markdown-density="density"
      />
    </Suspense>
  </div>
</template>
