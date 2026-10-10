import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import CloudSaveDialog from './CloudSaveDialog.vue'
import type { CloudSaveDestination, CloudSaveState } from './types'

type Args = {
  destinations: CloudSaveDestination[]
  state: CloudSaveState
  destination: string
  onSave: () => void
}

const official: CloudSaveDestination = {
  serverId: 'official',
  host: 'cloud.openpencil.dev',
  workspaces: [
    { id: 'design', name: 'Design team', role: 'editor' },
    { id: 'personal', name: 'Personal', role: 'admin' },
    { id: 'brand', name: 'Brand archive', role: 'viewer' }
  ]
}
const team: CloudSaveDestination = {
  serverId: 'acme',
  host: 'design.acme.internal',
  workspaces: [{ id: 'product', name: 'Product', role: 'editor' }]
}

const meta = {
  title: 'App/Cloud/Save Dialog',
  tags: ['autodocs'],
  args: {
    destinations: [official],
    state: { kind: 'ready' },
    destination: 'official/design',
    onSave: fn()
  },
  render: (args) => ({
    components: { CloudSaveDialog },
    setup: () => ({ args, name: ref('Onboarding flow'), destination: ref(args.destination) }),
    template: `
      <div class="h-[680px]">
        <CloudSaveDialog :open="true" v-model:name="name" v-model:destination="destination" :destinations="args.destinations" :state="args.state" @save="args.onSave" />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseWorkspace: Story = {}
export const TwoServers: Story = { args: { destinations: [official, team] } }
export const Uploading: Story = {
  args: { state: { kind: 'saving', sentBytes: 14.2 * 1024 ** 2, totalBytes: 38.5 * 1024 ** 2 } }
}
export const TooLarge: Story = {
  args: { state: { kind: 'error', reason: 'too-large', limitBytes: 256 * 1024 ** 2 } }
}
export const Offline: Story = { args: { state: { kind: 'error', reason: 'offline' } } }
