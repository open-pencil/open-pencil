import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import CloudReportDialog from './CloudReportDialog.vue'

type Args = {
  host: string
  email: string | null
  busy: boolean
  failure: 'failed' | 'too-many' | null
}

const meta = {
  title: 'App/Cloud/Report a Shared File',
  tags: ['autodocs'],
  args: { host: 'cloud.openpencil.dev', email: null, busy: false, failure: null },
  render: (args) => ({
    components: { CloudReportDialog },
    setup: () => ({ args }),
    template: `
      <div class="h-140">
        <CloudReportDialog
          :open="true"
          :host="args.host"
          :email="args.email"
          :busy="args.busy"
          :failure="args.failure"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** A guest reporting a file: Send waits for a description, and an address that is one, or none. */
export const Guest: Story = {
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'))
    const send = dialog.getByRole('button', { name: 'Send report' })
    await expect(send).toBeDisabled()
    await userEvent.type(dialog.getByLabelText('Details'), 'A fake sign-in page')
    await expect(send).toBeEnabled()
    const email = dialog.getByLabelText('Your email (optional)')
    await userEvent.type(email, 'not an address')
    await expect(send).toBeDisabled()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await userEvent.clear(email)
    await expect(send).toBeEnabled()
    await expect(email).not.toHaveAttribute('aria-invalid')
  }
}

/** Someone signed in to the server, whose address is offered for a reply. */
export const SignedIn: Story = { args: { email: 'ana@studio.example' } }

/** The day's reports about this file are used up. */
export const TooMany: Story = { args: { failure: 'too-many' } }
