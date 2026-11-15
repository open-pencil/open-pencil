import { defineMarkdownDocumentComponent } from '@comark/vue'

import InlineCode from './InlineCode.vue'
import MarkdownCodeBlock from './MarkdownCodeBlock.vue'
import MarkdownImage from './MarkdownImage.vue'
import MarkdownLink from './MarkdownLink.vue'
import MarkdownTable from './MarkdownTable.vue'
import TaskCheckbox from './TaskCheckbox.vue'

/** Comark's document renderer with the app's own elements for what Markdown draws. */
export const AppMarkdownDocument = defineMarkdownDocumentComponent({
  name: 'AppMarkdownDocument',
  components: {
    a: MarkdownLink,
    code: InlineCode,
    img: MarkdownImage,
    input: TaskCheckbox,
    pre: MarkdownCodeBlock,
    table: MarkdownTable
  }
})
