import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { UIMessage } from 'ai'
import { expect } from 'storybook/test'

import ChatMessage from './ChatMessage.vue'

const userMessage: UIMessage = {
  id: 'user-message',
  role: 'user',
  parts: [{ type: 'text', text: 'Rename these cells using the selected layer.' }]
}

const assistantMessage: UIMessage = {
  id: 'assistant-message',
  role: 'assistant',
  parts: [
    {
      type: 'text',
      text: 'Done. Names now follow `Cell_R{row}C{col}`, from `Row_1` through `Row_4`.'
    }
  ]
}

const reasoningMessage: UIMessage = {
  id: 'reasoning-message',
  role: 'assistant',
  parts: [
    { type: 'reasoning', text: 'Inspecting the selected hierarchy.', state: 'done' },
    { type: 'text', text: 'The hierarchy is consistent.' }
  ]
}

/** A reply stopped mid-call, as the chat settles it: nothing reads as running any more. */
const stoppedMessage: UIMessage = {
  id: 'stopped-message',
  role: 'assistant',
  metadata: { stopped: true },
  parts: [
    { type: 'reasoning', text: 'Laying out a month grid.', state: 'done' },
    {
      type: 'tool-render',
      toolCallId: 'stopped-call',
      state: 'output-error',
      input: { jsx: '<Frame name="Calendar" />' },
      errorText: 'The reply ended before this call finished. It did not change the document.'
    }
  ]
}

/** A reply with one of its two edits undone, by Undo in the editor or the chat's Revert. */
const partlyUndoneMessage: UIMessage = {
  id: 'partly-undone-message',
  role: 'assistant',
  metadata: {
    undo: {
      edits: [
        { tool: 'node_resize', toolCallId: 'resize' },
        { tool: 'set_opacity', toolCallId: 'fade' }
      ],
      undone: ['fade']
    }
  },
  parts: [
    {
      type: 'tool-node_resize',
      toolCallId: 'resize',
      state: 'output-available',
      input: { id: '0:1', width: 200, height: 60 },
      output: { id: '0:1' }
    },
    {
      type: 'tool-set_opacity',
      toolCallId: 'fade',
      state: 'output-available',
      input: { id: '0:1', value: 0.5 },
      output: { id: '0:1' }
    },
    { type: 'text', text: 'Widened the card and faded it.' }
  ]
}

type ChatMessageStoryArgs = {
  message: UIMessage
  streaming?: boolean
  canRegenerate?: boolean
}

const meta = {
  title: 'App/Chat/Message',
  component: ChatMessage,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { ChatMessage },
    setup: () => ({ args }),
    template:
      '<div class="w-96 rounded-xl bg-panel p-4 text-surface"><ChatMessage v-bind="args" /></div>'
  })
} satisfies Meta<ChatMessageStoryArgs>

export default meta
type Story = StoryObj<ChatMessageStoryArgs>

export const User: Story = { args: { message: userMessage } }
export const Assistant: Story = { args: { message: assistantMessage } }
export const Reasoning: Story = { args: { message: reasoningMessage } }
export const Streaming: Story = { args: { message: assistantMessage, streaming: true } }

export const Stopped: Story = {
  args: { message: stoppedMessage },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="chat-turn-stopped"]')).toBeVisible()
    // The stopped reply's reasoning no longer reads as running.
    await expect(
      canvasElement.querySelector('[data-slot="chat-reasoning-trigger"]')
    ).not.toHaveAttribute('data-streaming')
  }
}

export const PartlyUndone: Story = {
  args: { message: partlyUndoneMessage },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="chat-turn-undone"]')).toBeVisible()
    const undone = canvasElement.querySelectorAll(
      '[data-slot="chat-tool-call"][data-undone="true"]'
    )
    await expect(undone).toHaveLength(1)
  }
}

/** A finished reply with the tokens it used, which the default setting shows on hover. */
export const WithUsage: Story = {
  args: {
    message: {
      id: 'usage-message',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'I added two more rectangles, green and magenta, each 160×120 with 8px corners. They sit in a second row under the first pair, and I zoomed the view to show all four rectangles.'
        }
      ],
      metadata: {
        usage: {
          contextTokens: 29_300,
          inputTokens: 28_700,
          outputTokens: 609,
          cacheReadTokens: null
        }
      }
    },
    canRegenerate: true
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="chat-reply-usage"]')).toHaveTextContent(
      '28.7K in · 609 out'
    )
  }
}
