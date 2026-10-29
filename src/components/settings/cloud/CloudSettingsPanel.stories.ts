import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'

import CloudSettingsPanel from './CloudSettingsPanel.vue'
import type { CloudServerEntry } from './types'

type Args = {
  servers: CloudServerEntry[]
  listed: boolean
  confirmRemove: boolean
  onConnect: () => void
}

const official: CloudServerEntry = {
  id: 'official',
  host: 'cloud.openpencil.dev',
  kind: 'official',
  account: { id: 'user-ana', name: 'Ana Duarte', email: 'ana@studio.example' },
  session: 'signed-in',
  onHome: true
}
const team: CloudServerEntry = {
  id: 'acme',
  host: 'design.acme.internal',
  kind: 'self-hosted',
  account: { id: 'user-ana-acme', name: 'Ana Duarte', email: 'ana.duarte@acme.example' },
  session: 'signed-in',
  onHome: false
}

const meta = {
  title: 'App/Settings/Cloud',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { servers: [official, team], listed: true, confirmRemove: false, onConnect: fn() },
  render: (args) => ({
    components: { CloudSettingsPanel, AppConfirmationDialog },
    setup: () => ({ args }),
    template: `
      <div class="flex h-[560px] bg-panel p-6">
        <div class="flex w-full max-w-2xl flex-col">
          <CloudSettingsPanel :servers="args.servers" :listed="args.listed" @connect="args.onConnect">
            <template #hosted>
              <div class="rounded border border-dashed border-border p-3 text-[11px] text-muted">
                The OpenPencil Cloud waitlist
              </div>
            </template>
          </CloudSettingsPanel>
        </div>
        <AppConfirmationDialog
          :open="args.confirmRemove"
          tone="danger"
          heading="Disconnect design.acme.internal?"
          description="You’re signed out and its workspaces leave Home on this device. 2 documents have changes that haven’t reached the server yet; disconnecting discards them."
          cancel-label="Cancel"
          confirm-label="Disconnect and discard changes"
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
/** Before the hosted service opens, its waitlist takes the place of connecting to it. */
export const BeforeLaunch: Story = { args: { servers: [], listed: false } }
export const RemoveWithUnsavedChanges: Story = { args: { confirmRemove: true } }
