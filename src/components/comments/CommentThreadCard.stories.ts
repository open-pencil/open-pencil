import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { TooltipProvider } from 'reka-ui'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { CommentThread } from '@open-pencil/scene-graph'

import type { MentionPerson } from '@/app/comments/mentions/links'

import CommentComposer from './CommentComposer.vue'
import CommentThreadCard from './CommentThreadCard.vue'
import { discussed, long, resolved } from './examples/threads'

type Args = {
  thread: CommentThread
  readOnly?: boolean
  mentionable?: () => Promise<readonly MentionPerson[]>
  onReply: (threadId: string, text: string) => void
}

const meta = {
  title: 'App/Editor/Comments/Thread Card',
  component: CommentThreadCard,
  tags: ['autodocs'],
  args: { thread: discussed, onReply: fn() },
  render: (args) => ({
    components: { CommentThreadCard, TooltipProvider },
    setup: () => ({ args }),
    template: `
      <TooltipProvider>
        <div class="flex max-h-[28rem] w-80 flex-col overflow-hidden rounded-xl bg-panel shadow-[0_0_0_1px_var(--color-border)]">
          <CommentThreadCard
            :thread="args.thread"
            :read-only="args.readOnly"
            :mentionable="args.mentionable"
            @reply="args.onReply"
          />
        </div>
      </TooltipProvider>
    `
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** Markdown from Figma's formatting: bold, italic, strikethrough, a list and a link. */
export const Formatted: Story = {}

export const Resolved: Story = { args: { thread: resolved } }

export const LongThread: Story = { args: { thread: long } }

const people: MentionPerson[] = [
  { id: 'acc-ada', name: 'Ada Lovelace', image: null },
  { id: 'acc-grace', name: 'Grace Hopper', image: null },
  { id: 'acc-alan', name: 'Alan Kay', image: null }
]

/** `@` offers the people who can open the document; the one picked is sent as a mention. */
export const Mentioning: Story = {
  args: { mentionable: async () => people },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const reply = canvas.getByRole('textbox', { name: 'Reply' })
    await userEvent.type(reply, 'Thanks @gra')
    const options = await canvas.findAllByRole('option')
    await expect(options[0]).toHaveTextContent('Grace Hopper')
    await userEvent.keyboard('{Enter}')
    await expect(reply).toHaveValue('Thanks @Grace Hopper ')
    await userEvent.keyboard('{Enter}')
    await expect(args.onReply).toHaveBeenCalledWith(
      discussed.id,
      'Thanks [@Grace Hopper](openpencil://person/acc-grace)'
    )
  }
}

/** A guest on a link reads the thread and cannot answer, resolve, or delete in it. */
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('textbox', { name: 'Reply' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Resolve' })).toBeNull()
  }
}

export const Replying: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const reply = canvas.getByRole('textbox', { name: 'Reply' })
    await userEvent.type(reply, 'Looks right')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await userEvent.type(reply, 'Shipping it')
    await userEvent.keyboard('{Enter}')
    await expect(args.onReply).toHaveBeenCalledWith(discussed.id, 'Looks right\nShipping it')
    await expect(reply).toHaveValue('')
  }
}

/** The composer on its own, as it opens on a new pin: Shift+Enter continues a list, then ends it. */
export const NewComment: StoryObj<{ onSubmit: (text: string) => void }> = {
  args: { onSubmit: fn() },
  render: (args) => ({
    components: { CommentComposer },
    setup: () => ({ args }),
    template:
      '<div class="w-72 rounded-xl bg-panel p-2 shadow-[0_0_0_1px_var(--color-border)]"><CommentComposer label="Add a comment" @submit="args.onSubmit" /></div>'
  }),
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Add a comment' })
    await userEvent.type(input, '- first')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await expect(input).toHaveValue('- first\n- ')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await expect(input).toHaveValue('- first\n')
    await userEvent.keyboard('{Enter}')
    await expect(args.onSubmit).toHaveBeenCalledWith('- first')
  }
}
