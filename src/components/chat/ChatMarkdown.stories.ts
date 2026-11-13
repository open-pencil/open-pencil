import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ref } from 'vue'

import ChatMarkdown from './ChatMarkdown.vue'

type ChatMarkdownStoryArgs = {
  content: string
  mode?: 'static' | 'streaming'
}

/**
 * vue-stream-markdown wraps each code block in its own <header> and <main>, which its component
 * overrides cannot replace; until upstream drops them they read as page landmarks.
 */
const codeBlockLandmarks = {
  a11y: {
    config: {
      rules: [
        'landmark-banner-is-top-level',
        'landmark-main-is-top-level',
        'landmark-no-duplicate-banner',
        'landmark-no-duplicate-main',
        'landmark-unique'
      ].map((id) => ({ id, enabled: false }))
    }
  }
}

type Story = StoryObj<ChatMarkdownStoryArgs>

const meta = {
  title: 'App/Chat/Markdown',
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
  parameters: codeBlockLandmarks,
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
  parameters: codeBlockLandmarks,
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

export const Table: Story = {
  args: {
    content: `The button now has these states:

| State | Look |
| --- | --- |
| Default | Burnt orange \`#c2410c\` with the soft glow |
| Hover | Brighter \`#ea580c\` with a bigger glow |
| Disabled | Muted \`#374151\` with grey text |`
  }
}

export const TaskList: Story = {
  args: {
    content: `- [x] Variants created
- [ ] Checked in preview

See [the guide](https://openpencil.dev/guide).`
  }
}

export const Streaming: Story = {
  args: {
    mode: 'streaming',
    content:
      'The assistant is writing **streamed content** with `inline_code` and an unfinished [link'
  }
}

/** A reply that finishes, which the Finish button stands in for, keeps the text as it was drawn. */
export const Finishing: Story = {
  args: {
    content:
      'The card now **hugs** its content, with `16px` between [its rows](https://openpencil.dev).'
  },
  render: (args) => ({
    components: { ChatMarkdown },
    setup: () => ({ args, mode: ref<'static' | 'streaming'>('streaming') }),
    template: `<div class="w-80 space-y-2">
      <div class="rounded-xl bg-hover px-3 py-2 text-surface"><ChatMarkdown :content="args.content" :mode="mode" /></div>
      <button type="button" class="text-xs text-surface" @click="mode = 'static'">Finish</button>
    </div>`
  }),
  play: async ({ canvasElement }) => {
    const markdown = canvasElement.querySelector('[data-markdown-mode]')
    await expect(markdown).toHaveAttribute('data-markdown-mode', 'streaming')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Finish' }))
    await waitFor(() => expect(markdown).toHaveAttribute('data-markdown-mode', 'static'))
    // Still the element that streamed: a new one would fade the read text in again.
    await expect(canvasElement.querySelector('[data-markdown-mode]')).toBe(markdown)
  }
}
