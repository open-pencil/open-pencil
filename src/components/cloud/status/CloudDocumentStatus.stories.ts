import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { userEvent, within } from 'storybook/test'
import IconSettings from '~icons/lucide/settings'

import type { CloudSyncState } from '@/components/home/cloud/types'
import IconButton from '@/components/ui/button/IconButton.vue'

import CloudDocumentStatus from './CloudDocumentStatus.vue'

type Args = { state: CloudSyncState; viewOnly: boolean; savedAgo: string | null }

const meta = {
  title: 'App/Cloud/Document Status',
  tags: ['autodocs'],
  args: { state: 'synced', viewOnly: false, savedAgo: 'just now' },
  render: (args) => ({
    components: { CloudDocumentStatus, IconButton, IconSettings },
    setup: () => ({ args }),
    template: `
      <div class="h-[320px]">
        <div class="flex w-64 items-center gap-1 border-b border-border bg-panel px-2 py-2">
          <span class="flex size-6 items-center justify-center rounded bg-accent text-[11px] font-bold text-on-accent">P</span>
          <span class="min-w-0 flex-1 truncate px-1 text-xs text-surface">Homepage redesign</span>
          <CloudDocumentStatus :state="args.state" :view-only="args.viewOnly" :saved-ago="args.savedAgo" workspace="Design team" host="cloud.openpencil.dev" />
          <IconButton label="Settings"><IconSettings class="size-3.5" /></IconButton>
        </div>
      </div>`
  }),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('[data-state-sync]')
    if (trigger) await userEvent.click(trigger)
    await within(document.body).findByRole('dialog')
  }
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Saved: Story = {}
export const Saving: Story = { args: { state: 'uploading' } }
export const Offline: Story = { args: { state: 'offline' } }
export const NeedsAChoice: Story = { args: { state: 'conflict' } }
export const CouldNotSave: Story = { args: { state: 'error' } }
export const ViewOnly: Story = { args: { viewOnly: true } }
