import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'

import CloudSettingsPanel from './CloudSettingsPanel.vue'
import type { CloudServerEntry } from './types'

type Args = { servers: CloudServerEntry[]; confirmRemove: boolean; onConnect: () => void }

const official: CloudServerEntry = {
  id: 'official',
  host: 'cloud.openpencil.dev',
  kind: 'official',
  account: { id: 'user-ana', name: 'Ana Duarte', email: 'ana@studio.example' },
  session: 'signed-in',
  onHome: true,
  unsaved: 0
}
const team: CloudServerEntry = {
  id: 'acme',
  host: 'design.acme.internal',
  kind: 'self-hosted',
  account: { id: 'user-ana-acme', name: 'Ana Duarte', email: 'ana.duarte@acme.example' },
  session: 'signed-in',
  onHome: false,
  unsaved: 2
}

const meta = {
  title: 'App/Settings/Cloud',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { servers: [official, team], confirmRemove: false, onConnect: fn() },
  render: (args) => ({
    components: { CloudSettingsPanel, AppConfirmationDialog },
    setup: () => ({ args }),
    template: `
      <div class="flex h-[560px] bg-panel p-6">
        <div class="flex w-full max-w-2xl flex-col">
          <CloudSettingsPanel :servers="args.servers" @connect="args.onConnect" />
        </div>
        <AppConfirmationDialog
          :open="args.confirmRemove"
          tone="danger"
          heading="Remove design.acme.internal?"
          description="You’re signed out and its workspaces leave Home on this device. 2 documents have changes that haven’t reached the server yet; removing it discards them."
          cancel-label="Cancel"
          confirm-label="Remove and discard changes"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const TwoServers: Story = {}
export const SignInExpired: Story = {
  args: { servers: [official, { ...team, session: 'expired' }] }
}
export const NoServers: Story = { args: { servers: [] } }
export const RemoveWithUnsavedChanges: Story = { args: { confirmRemove: true } }
