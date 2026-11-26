<script setup lang="ts">
import type { MarkdownDocument } from 'comark'
import { tv } from 'tailwind-variants'
import { shallowRef, watch } from 'vue'

import { AppMarkdownDocument } from '@/components/markdown/document'
import theme, { type MarkdownDensity } from '@/theme/markdown'

import CampaignMarkdownLink from './CampaignMarkdownLink.vue'
import { CampaignMarkdownImage, parseCampaignMarkdown } from './markdown'

/**
 * A campaign's Markdown body, drawn as text: it parses with the campaign rules
 * (`./markdown.ts`) rather than chat's, and renders with the app's Markdown elements, except
 * that links open only on openpencil.dev and images draw nothing.
 */
const {
  content,
  density = 'compact',
  class: className
} = defineProps<{ content: string; density?: MarkdownDensity; class?: string }>()

const ui = tv(theme)()
const components = { a: CampaignMarkdownLink, img: CampaignMarkdownImage }
const parsed = shallowRef<MarkdownDocument | null>(null)

watch(
  () => content,
  async (text) => {
    parsed.value = await parseCampaignMarkdown(text)
  },
  { immediate: true }
)
</script>

<template>
  <div data-slot="markdown" :class="ui.root({ class: className })">
    <!-- Comark's renderers are async components and render inside a Suspense. -->
    <Suspense>
      <AppMarkdownDocument
        v-if="parsed"
        :value="parsed"
        :components="components"
        :class="ui.markdown()"
        data-markdown-mode="static"
        :data-markdown-density="density"
      />
    </Suspense>
  </div>
</template>
