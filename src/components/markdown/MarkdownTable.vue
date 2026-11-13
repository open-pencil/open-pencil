<script setup lang="ts">
import type { ElementNode } from 'comark'
import { renderMarkdown } from 'comark/render'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'

/** A table that scrolls on its own when wide, with a button that copies it as Markdown. */
const { __node: node } = defineProps<{
  /** The table as Comark parsed it, which renders back to Markdown. */
  // eslint-disable-next-line vue/prop-name-casing -- Comark passes the node only to `__node`.
  __node: ElementNode
}>()

const common = useCommonMessages()
</script>

<template>
  <div data-markdown="table-wrapper">
    <div data-markdown="table-controls">
      <AppCopyButton
        :value="() => renderMarkdown({ nodes: [node] })"
        :label="common.copyTable"
        :copied-label="common.copied"
        icon
      />
    </div>
    <div data-markdown="table-scroll">
      <table data-markdown="table">
        <slot />
      </table>
    </div>
  </div>
</template>
