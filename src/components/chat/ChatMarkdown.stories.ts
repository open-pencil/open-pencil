import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ChatMarkdown from './ChatMarkdown.vue'

type ChatMarkdownStoryArgs = {
  content: string
  mode?: 'static' | 'streaming'
}

type Story = StoryObj<ChatMarkdownStoryArgs>

const meta = {
  title: 'Chat/Markdown',
  component: ChatMarkdown,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { ChatMarkdown },
    setup: () => ({ args }),
    template:
      '<div class="w-80 rounded-xl bg-hover px-3 py-2 text-surface"><ChatMarkdown v-bind="args" /></div>'
  })
} satisfies Meta<ChatMarkdownStoryArgs>

export default meta

export const Prose: Story = {
  args: {
    content: `# Compact heading

A paragraph with **bold text**, *emphasis*, and [a link](https://openpencil.dev).

## Smaller heading

- First item
- Second item

---

Closing paragraph.`
  }
}

export const InlineCode: Story = {
  args: {
    content:
      'Rename cells using `Cell_R{row}C{col}`. Rows run from `Row_1` through `Row_4`; for example, use `Cell_R2C3`.'
  }
}

export const CodeBlock: Story = {
  args: {
    content: `\`\`\`typescript
const button = {
  label: 'Subscribe',
  rounded: 8,
}
\`\`\``
  }
}

export const MixedContent: Story = {
  args: {
    content: `## Updated layout

The grid uses \`Cell_R{row}C{col}\` names.

\`\`\`typescript
const columns = 4
const rows = 4
\`\`\`

> Names remain stable when cells move.`
  }
}

export const Streaming: Story = {
  args: {
    mode: 'streaming',
    content:
      'The assistant is writing **streamed content** with `inline_code` and an unfinished [link'
  }
}
