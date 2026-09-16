import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { TooltipProvider } from 'reka-ui'
import { expect, userEvent, within } from 'storybook/test'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import ChatComposer from './ChatComposer.vue'
import ChatHistory from './ChatHistory.vue'
import ChatTranscript from './ChatTranscript.vue'
import { useConversations } from './stories/useConversations'

interface Args {
  initialChat: string
  narrow: boolean
}
const meta = {
  title: 'Chat/Playground',
  args: { initialChat: 'dashboard', narrow: false },
  parameters: {
    docs: {
      description: {
        component:
          'The real transcript and composer, composed with isolated story fixtures. Controls above the panel are test controls, not the proposed history UI. No credentials, model calls, document edits, or persistence.'
      }
    }
  },
  render: (args) => ({
    components: {
      ChatHistory,
      ChatComposer,
      ChatTranscript,
      TooltipProvider,
      AppSelect,
      AppButton
    },
    setup() {
      return { args, ...useConversations(args.initialChat) }
    },
    template: `
      <TooltipProvider>
        <div class="max-w-full space-y-3">
          <fieldset class="max-w-[420px] space-y-2 rounded border border-border p-3 text-xs">
            <legend class="px-1 text-muted">Story controls — not saved</legend>
            <AppSelect v-model="selectedId" label="Test conversation" :options="options" />
            <div class="flex gap-2">
              <AppButton size="xs" @click="newChat">New fixture</AppButton>
              <AppButton size="xs" @click="removeChat">Delete fixture</AppButton>
            </div>
            <label v-if="selected" class="flex items-center gap-2">Title
              <input v-model="selected.title" class="min-w-0 flex-1 rounded border border-border bg-input p-1" />
            </label>
          </fieldset>
          <section aria-label="Chat preview" :data-narrow="args.narrow" class="flex h-[620px] w-[420px] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-panel data-[narrow=true]:w-[300px]">
            <ChatHistory
              :saved="hasSavedConversation"
              :conversations="conversationOptions"
              :selected-id="selectedId"
              @select="selectConversation"
              @create="newChat"
              @rename="renameChat"
              @delete="removeChat"
              @copy-debug="copyDiagnostics"
            />
            <ChatTranscript
              v-if="selected"
              :key="selected.id"
              :messages="selected.messages"
              :presentations="presentations"
              :status="selected.status"
            />
            <p v-if="notice" role="status" class="px-3 py-2 text-xs text-muted">{{ notice }}</p>
            <ChatComposer
              :key="selectedId"
              :status="selected?.status ?? 'ready'"
              @submit="submit"
              @stop="stop"
              @settings="showProfileNotice"
            >
              <template #model>
                <AppSelect
                  v-model="profile"
                  label="Mock model profile"
                  :options="profileOptions"
                />
              </template>
            </ChatComposer>
          </section>
        </div>
      </TooltipProvider>`
  })
} satisfies Meta<Args>
export default meta
type Story = StoryObj<typeof meta>
export const Conversations: Story = {}
export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'New fixture' }))
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Describe a change' }),
      'Make a dashboard'
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(canvas.getByText(/local preview response/)).toBeVisible()
    const title = canvas.getByRole('textbox', { name: 'Title' })
    await expect(title).toHaveValue('Make a dashboard')
    await userEvent.clear(title)
    await userEvent.type(title, 'My dashboard')
    await userEvent.click(canvas.getByRole('button', { name: 'Delete fixture' }))
    await expect(title).toHaveValue('Monthly expense dashboard')
    await expect(canvas.getByRole('button', { name: 'Create Frame Done' })).toBeVisible()
  }
}
export const Empty: Story = { args: { initialChat: 'empty' } }
export const Streaming: Story = { args: { initialChat: 'streaming' } }
export const ToolError: Story = { args: { initialChat: 'error' } }
export const Narrow: Story = { args: { narrow: true } }
export const LongTitle: Story = { args: { initialChat: 'long-title', narrow: true } }
