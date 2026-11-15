import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { DesignReview } from '@/app/ai/review/message'

import ChatReviewCard from './ChatReviewCard.vue'

type ReviewStoryArgs = {
  review: DesignReview
  canFix?: boolean
  onFix?: () => void
}

const meta = {
  title: 'App/Chat/Review Card',
  component: ChatReviewCard,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { ChatReviewCard },
    setup: () => ({ args }),
    template:
      '<div class="w-96 rounded-xl bg-panel p-4 text-surface"><ChatReviewCard v-bind="args" /></div>'
  })
} satisfies Meta<ReviewStoryArgs>

export default meta
type Story = StoryObj<ReviewStoryArgs>

const review: DesignReview = {
  findings: [
    '- **Track**: the title and artist sit tight under the artwork. Raise the gap to 24px so the metadata reads as one block.',
    '- **Progress**: 12px timestamps are weak next to the artwork. Set them to 13px and raise their contrast.'
  ].join('\n'),
  nodeIds: ['1:2'],
  focus: 'spacing and hierarchy'
}

export const Findings: Story = {
  args: { review, canFix: true, onFix: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('spacing and hierarchy')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Fix these' }))
    await expect(args.onFix).toHaveBeenCalledOnce()
  }
}

/** While the chat is busy, the findings wait to be sent. */
export const Busy: Story = {
  args: { review: { ...review, focus: undefined }, canFix: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Fix these' })).toBeDisabled()
  }
}
