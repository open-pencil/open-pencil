import type { Meta, StoryObj } from '@storybook/vue3-vite'
import IconSettings from '~icons/lucide/settings'

import type { CloudSyncState } from '@/components/home/cloud/types'
import IconButton from '@/components/ui/button/IconButton.vue'

import CloudDocumentStatus from './CloudDocumentStatus.vue'
import { openStatusPopover, statusToolbarTemplate } from './examples/toolbar'

type Args = {
  state: CloudSyncState
  viewOnly: boolean
  savedAgo: string | null
  notLive: boolean
  canRejoin: boolean
}

const meta = {
  title: 'App/Cloud/Document Status',
  tags: ['autodocs'],
  args: {
    state: 'synced',
    viewOnly: false,
    savedAgo: 'just now',
    notLive: false,
    canRejoin: false
  },
  render: (args) => ({
    components: { CloudDocumentStatus, IconButton, IconSettings },
    setup: () => ({ args }),
    template: statusToolbarTemplate(
      `<CloudDocumentStatus :state="args.state" :view-only="args.viewOnly" :not-live="args.notLive" :can-rejoin="args.canRejoin" :saved-ago="args.savedAgo" workspace="Design team" host="cloud.openpencil.dev" />
          <IconButton label="Settings"><IconSettings class="size-3.5" /></IconButton>`,
      'h-80'
    )
  }),
  play: openStatusPopover
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Saved: Story = {}
export const Saving: Story = { args: { state: 'uploading' } }
export const Offline: Story = { args: { state: 'offline' } }
export const NeedsAChoice: Story = { args: { state: 'conflict' } }
export const CouldNotSave: Story = { args: { state: 'error' } }
export const ViewOnly: Story = { args: { viewOnly: true } }
export const NotLive: Story = { args: { notLive: true, canRejoin: true } }
