import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { ReasoningDisplay } from '@/app/settings/preferences/store'

import ReasoningBlock from './ReasoningBlock.vue'

interface Args {
  text: string
  thinkingLabel: string
  reasoningLabel: string
  streaming: boolean
  display: ReasoningDisplay
}

const meta = {
  title: 'Chat/Reasoning',
  component: ReasoningBlock,
  args: {
    text: 'I’ll inspect the selected frame, compare its spacing, and arrange the summary cards.\n\nThe layout should keep a consistent **24 px gap**.',
    thinkingLabel: 'Thinking…',
    reasoningLabel: 'Reasoning',
    streaming: false,
    display: 'collapsed'
  },
  render: (args) => ({
    components: { ReasoningBlock },
    setup: () => ({ args }),
    template: '<div class="w-80"><ReasoningBlock v-bind="args" /></div>'
  })
} satisfies Meta<Args>
export default meta
type Story = StoryObj<Omit<typeof meta, 'component'>>
export const Collapsed: Story = {}
export const Expanded: Story = { args: { display: 'expanded' } }
export const WhileThinking: Story = { args: { display: 'while-thinking', streaming: true } }
