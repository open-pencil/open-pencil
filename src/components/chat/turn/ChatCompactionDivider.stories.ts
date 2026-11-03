import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import type { Compaction } from '@/app/ai/chat/compaction/marker'

import ChatCompactionDivider from './ChatCompactionDivider.vue'

type DividerStoryArgs = {
  compaction: Compaction
  tokensAfter?: number | null
}

const meta = {
  title: 'App/Chat/Compaction Divider',
  component: ChatCompactionDivider,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { ChatCompactionDivider },
    setup: () => ({ args }),
    template:
      '<div class="w-96 rounded-xl bg-panel p-4 text-surface"><ChatCompactionDivider v-bind="args" /></div>'
  })
} satisfies Meta<DividerStoryArgs>

export default meta
type Story = StoryObj<DividerStoryArgs>

export const Summary: Story = {
  args: {
    compaction: {
      summary:
        '## State\n- A calendar component with default, today, and selected variants.\n- Colors bound to variables.',
      trigger: 'auto',
      tokensBefore: 45_100
    },
    tokensAfter: 33_900
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Conversation compacted/ }))
    await expect(canvas.getByText('45.1K → 33.9K tokens')).toBeVisible()
  }
}

/** An agent such as Pi compacted its own context and reported no summary. */
export const Agent: Story = {
  args: {
    compaction: { summary: '', trigger: 'manual', tokensBefore: null, agent: true }
  }
}
