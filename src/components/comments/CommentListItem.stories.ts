import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { CommentThread } from '@open-pencil/scene-graph'

import CommentListItem from './CommentListItem.vue'
import CommentPin from './CommentPin.vue'
import { discussed, long, resolved } from './examples/threads'

type Args = { thread: CommentThread; number: number; pageName: string; active: boolean }

const meta = {
  title: 'App/Editor/Comments/List Item',
  component: CommentListItem,
  tags: ['autodocs'],
  args: { thread: discussed, number: 4, pageName: 'Checkout', active: false },
  render: (args) => ({
    components: { CommentListItem },
    setup: () => ({ args }),
    template: '<ul class="w-64 bg-panel"><CommentListItem v-bind="args" /></ul>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** Who took part, where, and a plain preview of the Markdown. */
export const Discussed: Story = {}

export const Active: Story = { args: { active: true } }

export const Resolved: Story = { args: { thread: resolved, number: 2 } }

export const LongText: Story = { args: { thread: long, number: 7 } }

/** Pins as they sit on the canvas: an author's avatar, open, resolved, and one being written. */
export const Pins: StoryObj = {
  render: () => ({
    components: { CommentPin },
    setup: () => ({ discussed }),
    template: `
      <div class="relative h-24 w-72 rounded-lg bg-canvas">
        <CommentPin :author="discussed.author" :color="discussed.authorColor" aria-label="Dana Scully" class="top-16 left-6" />
        <CommentPin :author="discussed.author" :color="discussed.authorColor" active aria-label="Dana Scully, open" class="top-16 left-24" />
        <CommentPin :author="discussed.author" :color="discussed.authorColor" resolved aria-label="Dana Scully, resolved" class="top-16 left-42" />
        <CommentPin draft aria-hidden="true" tabindex="-1" class="top-16 left-60" />
      </div>
    `
  })
}
