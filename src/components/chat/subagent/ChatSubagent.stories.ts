import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { provide, ref } from 'vue'

import { SUBAGENT_PART, type SubagentTranscript } from '@/app/ai/chat/subagents'
import type { ChatMessagePart } from '@/app/ai/chat/tool-calls/display'
import PanelDrillIn from '@/components/ui/panel/PanelDrillIn.vue'

import ChatSubagentCard from './ChatSubagentCard.vue'
import ChatSubagentHeader from './ChatSubagentHeader.vue'
import ChatSubagentThread from './ChatSubagentThread.vue'
import { OPEN_SUBAGENT_THREAD } from './context'

const working: SubagentTranscript = {
  session: 'left',
  title: 'Left card',
  description: 'Build the left pricing card with a heading and three rows.',
  state: 'running',
  agent: { id: 'agent-pico', name: 'Pico', color: '#2563EB' },
  parts: [
    { type: 'step-start' },
    { type: 'text', text: 'Building the card frame first.', state: 'done' },
    {
      type: 'tool-render',
      toolCallId: 'render-left',
      state: 'output-available',
      input: { jsx: '<Frame name="Left card" w={300} h={400} />' },
      output: { id: '12:4', name: 'Left card' }
    }
  ]
}

const done: SubagentTranscript = {
  session: 'right',
  title: 'Right card',
  state: 'idle',
  agent: { id: 'agent-tidal', name: 'Tidal', color: '#EA580C' },
  parts: [{ type: 'text', text: 'The right card is ready.', state: 'done' }]
}

const waiting: SubagentTranscript = {
  session: 'review',
  title: 'Review',
  state: 'requires_action',
  parts: []
}

function part(transcript: SubagentTranscript): ChatMessagePart {
  return { type: SUBAGENT_PART, id: transcript.session, data: transcript }
}

const meta = {
  title: 'App/Chat/Subagent',
  parameters: { layout: 'centered' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

/** Cards in each state: at work, waiting for the person, and done. */
export const Cards: Story = {
  render: () => ({
    components: { ChatSubagentCard },
    setup: () => {
      provide(OPEN_SUBAGENT_THREAD, () => undefined)
      return { parts: [part(working), part(waiting), part(done)] }
    },
    template:
      '<div class="w-80 space-y-1.5"><ChatSubagentCard v-for="p in parts" :key="p.id" :part="p" /></div>'
  })
}

/** A card opens the subagent's thread over the chat, named in the header's place; Back returns. */
export const Thread: Story = {
  render: () => ({
    components: { ChatSubagentCard, ChatSubagentHeader, ChatSubagentThread, PanelDrillIn },
    setup: () => {
      const open = ref(false)
      provide(OPEN_SUBAGENT_THREAD, () => {
        open.value = true
      })
      return { open, part: part(working), transcript: working }
    },
    template: `<div class="flex h-96 w-80 flex-col bg-panel">
      <ChatSubagentHeader v-if="open" :transcript="transcript" @back="open = false" />
      <div v-else class="shrink-0 border-b border-border px-3 py-2 text-xs text-surface">Pricing cards</div>
      <PanelDrillIn :open="open">
        <template #detail><ChatSubagentThread :transcript="transcript" /></template>
        <div class="p-3"><ChatSubagentCard :part="part" /></div>
      </PanelDrillIn>
    </div>`
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Pico/ }))
    await expect(await canvas.findByTestId('chat-subagent-thread')).toBeVisible()
    await expect(canvas.getByTestId('chat-subagent-header')).toHaveTextContent('Pico')
    await expect(canvas.getByText('Building the card frame first.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back: Chat' }))
    // The thread slides away before it leaves.
    await waitFor(() => expect(canvas.queryByTestId('chat-subagent-thread')).toBeNull())
  }
}
