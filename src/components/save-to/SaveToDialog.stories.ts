import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import SaveToDialog from './SaveToDialog.vue'
import type { SaveDestination, SaveToState } from './types'

type Args = {
  destinations: SaveDestination[]
  state: SaveToState
  destination: string
  onSave: () => void
}

function workspace(
  server: { id: string; label: string },
  id: string,
  label: string,
  role: 'viewer' | 'editor' | 'admin'
): SaveDestination {
  return {
    key: `${server.id}/${id}`,
    location: { providerId: 'openpencil-cloud', profileId: server.id, containerId: id },
    label,
    kind: 'workspace',
    place: server,
    role
  }
}

const officialServer = { id: 'official', label: 'cloud.openpencil.dev' }
const official = [
  workspace(officialServer, 'design', 'Design team', 'editor'),
  workspace(officialServer, 'personal', 'Personal', 'admin'),
  workspace(officialServer, 'brand', 'Brand archive', 'viewer')
]
const team = [
  workspace({ id: 'acme', label: 'design.acme.internal' }, 'product', 'Product', 'editor')
]
const bucket: SaveDestination = {
  key: 's3',
  location: { providerId: 's3-compatible' },
  label: 'studio-designs',
  kind: 'bucket',
  place: null
}

const meta = {
  title: 'App/Save To/Dialog',
  tags: ['autodocs'],
  args: {
    destinations: official,
    state: { kind: 'ready' },
    destination: 'official/design',
    onSave: fn()
  },
  render: (args) => ({
    components: { SaveToDialog },
    setup: () => ({ args, name: ref('Onboarding flow'), destination: ref(args.destination) }),
    template: `
      <div class="h-[680px]">
        <SaveToDialog :open="true" v-model:name="name" v-model:destination="destination" :destinations="args.destinations" :state="args.state" @save="args.onSave" />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseWorkspace: Story = {}
export const TwoServers: Story = { args: { destinations: [...official, ...team] } }
export const WorkspaceOrBucket: Story = { args: { destinations: [...official, bucket] } }
export const Uploading: Story = {
  args: { state: { kind: 'saving', sentBytes: 14.2 * 1024 ** 2, totalBytes: 38.5 * 1024 ** 2 } }
}
export const TooLarge: Story = {
  args: { state: { kind: 'error', reason: 'too-large', limitBytes: 256 * 1024 ** 2 } }
}
export const Offline: Story = { args: { state: { kind: 'error', reason: 'offline' } } }
