<script setup lang="ts">
import type { ElementNode } from 'comark'
import { textContent } from 'comark/utils'
import { computed } from 'vue'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'

/**
 * A fenced code block: its language and a copy button above the code. Shiki's class and styles
 * stay on the `<pre>`, and the code to copy comes from the parsed block (Comark's custom code
 * block pattern).
 */
defineOptions({ inheritAttrs: false })

const { __node: node, language } = defineProps<{
  // eslint-disable-next-line vue/prop-name-casing -- Comark passes the node only to `__node`.
  __node?: ElementNode
  language?: string
}>()

const common = useCommonMessages()
const code = computed(() => (node ? textContent(node) : ''))
</script>

<template>
  <div data-markdown="code-block">
    <div data-markdown="code-block-header">
      <span data-markdown="code-language">{{ language }}</span>
      <AppCopyButton :value="code" :label="common.copyCode" :copied-label="common.copied" icon />
    </div>
    <pre v-bind="$attrs" dir="ltr"><slot /></pre>
  </div>
</template>
