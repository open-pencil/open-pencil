import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { PortalAccessToken } from '../types'
import PortalAccessTokenDialog from './PortalAccessTokenDialog.vue'
import PortalAccessTokens from './PortalAccessTokens.vue'

const TOKENS: PortalAccessToken[] = [
  {
    id: 'token-1',
    name: 'Publish examples',
    start: 'opc_x7Kq',
    created: 'Nov 11, 2026',
    lastUsed: '2 hours ago',
    expires: 'Nov 11, 2027',
    expired: false
  },
  {
    id: 'token-2',
    name: 'Local scripts',
    start: 'opc_Pm3a',
    created: 'Aug 2, 2026',
    lastUsed: null,
    expires: 'Oct 31, 2026',
    expired: true
  }
]

const meta = {
  title: 'App/Cloud/Portal/Access Tokens',
  parameters: { layout: 'padded' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The account's tokens, one of them expired, with revoking asked once more. */
export const List: Story = {
  render: () => ({
    components: { PortalAccessTokens },
    setup: () => ({ tokens: TOKENS, onRevoke: fn() }),
    template: `<PortalAccessTokens :tokens="tokens" @revoke="onRevoke" />`
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Publish examples')).toBeVisible()
    await expect(canvas.getByText('Expired')).toBeVisible()
  }
}

/** Naming a new token and choosing how long it lasts. */
export const Create: Story = {
  render: () => ({
    components: { PortalAccessTokenDialog },
    setup: () => ({ onSubmit: fn() }),
    template: `<PortalAccessTokenDialog :open="true" @submit="onSubmit" />`
  }),
  play: async () => {
    const page = within(document.body)
    const create = page.getByRole('button', { name: 'Create token' })
    await expect(create).toBeDisabled()
    await userEvent.type(page.getByRole('textbox', { name: 'Name' }), 'Publish examples')
    await expect(create).toBeEnabled()
  }
}

/** The new token, shown once; the dialog closes only after it was copied. */
export const Created: Story = {
  render: () => ({
    components: { PortalAccessTokenDialog },
    template: `<PortalAccessTokenDialog :open="true" created="opc_x7KqZ2vN9hLwR4tYbC8mEaJ1pQsD6fGu" />`
  }),
  play: async () => {
    const page = within(document.body)
    await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled()
  }
}
