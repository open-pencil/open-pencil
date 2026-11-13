<script setup lang="ts">
import type { ElementNode } from 'comark'
import { textContent } from 'comark/utils'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'

/** A fenced code block: its language and a copy button above the code. */
const {
  language,
  class: className,
  __node: node
} = defineProps<{
  language?: string
  class?: string
  /** The block as Comark parsed it, which holds the code as written. */
  // eslint-disable-next-line vue/prop-name-casing -- Comark passes the node only to `__node`.
  __node: ElementNode
}>()

const common = useCommonMessages()
</script>

<template>
  <div data-markdown="code-block" class="group/code">
    <div data-markdown="code-block-header">
      <span data-markdown="code-language">{{ language }}</span>
      <AppCopyButton
        :value="async () => textContent(node)"
        :label="common.copyCode"
        :copied-label="common.copied"
        icon
      />
    </div>
    <pre :class="className" dir="ltr"><slot /></pre>
  </div>
</template>
