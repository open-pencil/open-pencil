import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import type { CloudAccountDeletion } from '@open-pencil/cloud/contract'

import type { PortalAccountArchive } from '@/components/cloud-portal/types'

import PortalDeleteAccountDialog from './PortalDeleteAccountDialog.vue'

type Args = {
  deletion: CloudAccountDeletion | null
  archive: PortalAccountArchive | null
  error: string | null
  onConfirm: () => void
  onDownloadAll: () => void
}

const EMAIL = 'ada@example.com'
const deletion: CloudAccountDeletion = {
  lastAdministrator: false,
  blockedBy: [],
  deletes: [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Ada’s workspace' },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Sketches' }
  ],
  leaves: [{ id: '00000000-0000-4000-8000-000000000004', name: 'Design team' }],
  documents: [
    { id: '00000000-0000-4000-8000-000000000011', name: 'Landing page', workspaceName: 'Sketches' },
    { id: '00000000-0000-4000-8000-000000000012', name: 'Icons', workspaceName: 'Design team' }
  ]
}

const meta = {
  title: 'App/Cloud Portal/Delete Account',
  args: { deletion, archive: null, error: null, onConfirm: fn(), onDownloadAll: fn() },
  render: (args) => ({
    components: { PortalDeleteAccountDialog },
    setup: () => ({ args, email: EMAIL }),
    template: `
      <PortalDeleteAccountDialog
        :open="true"
        :email="email"
        :deletion="args.deletion"
        :archive="args.archive"
        :error="args.error"
        @confirm="args.onConfirm"
        @download-all="args.onDownloadAll"
      />`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** Deleting waits for the email to be typed out. */
export const Ready: Story = {
  play: async ({ args }) => {
    const dialog = await within(document.body).findByRole('dialog')
    const submit = dialog.querySelector('button[type="submit"]')
    await expect(submit).toBeDisabled()
    await userEvent.type(within(dialog).getByRole('textbox'), EMAIL)
    await waitFor(() => expect(submit).toBeEnabled())
    if (submit instanceof HTMLElement) await userEvent.click(submit)
    await waitFor(() => expect(args.onConfirm).toHaveBeenCalled())
  }
}

/** The only admin of a workspace others use can't delete until they hand it on. */
export const Blocked: Story = {
  args: {
    deletion: {
      ...deletion,
      blockedBy: [{ id: '00000000-0000-4000-8000-000000000003', name: 'Design team' }]
    }
  },
  play: async () => {
    const dialog = await within(document.body).findByRole('dialog')
    await expect(within(dialog).queryByRole('textbox')).toBeNull()
    await expect(dialog.querySelector('button[type="submit"]')).toBeDisabled()
    await expect(within(dialog).getByRole('alert')).toBeVisible()
  }
}

/** The deployment's only administrator keeps the account until someone else is one. */
export const LastAdministrator: Story = {
  args: { deletion: { ...deletion, lastAdministrator: true } },
  play: async () => {
    const dialog = await within(document.body).findByRole('dialog')
    await expect(dialog.querySelector('button[type="submit"]')).toBeDisabled()
    await expect(within(dialog).getByText('Make someone else a server admin first')).toBeVisible()
  }
}

/** Download all on its way; deleting waits for it. */
export const Downloading: Story = {
  args: { archive: { done: 1, total: 2, saved: null, failed: [] } }
}

/** Download all finished, without one file. */
export const Downloaded: Story = {
  args: { archive: { done: 2, total: 2, saved: 1, failed: ['Icons'] } }
}

export const Loading: Story = { args: { deletion: null } }

export const Refused: Story = {
  args: { error: 'For your security, sign in again before making this change.' }
}
