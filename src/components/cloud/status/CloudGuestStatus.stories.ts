import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CloudGuestStatus from './CloudGuestStatus.vue'
import { openStatusPopover, statusToolbarTemplate } from './examples/toolbar'

type Args = { canEditSignedIn: boolean; atStorageLimit: boolean }

const meta = {
  title: 'App/Cloud/Guest Status',
  tags: ['autodocs'],
  args: { canEditSignedIn: true, atStorageLimit: false },
  render: (args) => ({
    components: { CloudGuestStatus },
    setup: () => ({ args }),
    template: statusToolbarTemplate(
      '<CloudGuestStatus :can-edit-signed-in="args.canEditSignedIn" :at-storage-limit="args.atStorageLimit" />',
      'h-60'
    )
  }),
  play: openStatusPopover
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** An edit link the guest may only view: signing in lets them edit. */
export const EditLink: Story = {}

/** A view link: nothing more to offer a guest. */
export const ViewLink: Story = { args: { canEditSignedIn: false } }

/** The document's owner holds their whole storage allowance, so nobody edits it for now. */
export const StorageFull: Story = { args: { atStorageLimit: true } }
