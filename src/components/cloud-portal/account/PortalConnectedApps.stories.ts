import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, within } from 'storybook/test'

import type { PortalAppConnection } from '../types'
import PortalConnectedApps from './PortalConnectedApps.vue'

const CONNECTIONS: PortalAppConnection[] = [
  {
    id: 'connection-1',
    name: 'Studio Assistant',
    host: 'assistant.studio.example',
    workspace: 'Studio',
    access: 'write',
    connected: 'Nov 11, 2026'
  },
  {
    id: 'connection-2',
    name: 'Release notes bot',
    host: null,
    workspace: 'Marketing',
    access: 'read',
    connected: 'Aug 2, 2026'
  }
]

const meta = {
  title: 'App/Cloud/Portal/Connected Apps',
  parameters: { layout: 'padded' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const onDisconnect = fn()

/** The account's connected apps, each with the host it gave, its workspace, and its access. */
export const List: Story = {
  render: () => ({
    components: { PortalConnectedApps },
    setup: () => ({ connections: CONNECTIONS, onDisconnect }),
    template: `<PortalConnectedApps :connections="connections" @disconnect="onDisconnect" />`
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Read and change')).toBeVisible()
    await expect(canvas.getByText('assistant.studio.example')).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: 'Disconnect' })).toHaveLength(2)
  }
}

/** No app connected yet. */
export const Empty: Story = {
  render: () => ({
    components: { PortalConnectedApps },
    template: `<PortalConnectedApps :connections="[]" />`
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No connected apps')).toBeVisible()
  }
}
