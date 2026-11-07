import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { userEvent, within } from 'storybook/test'

import CloudGuestStatus from './CloudGuestStatus.vue'

type Args = { canEditSignedIn: boolean }

const meta = {
  title: 'App/Cloud/Guest Status',
  tags: ['autodocs'],
  args: { canEditSignedIn: true },
  render: (args) => ({
    components: { CloudGuestStatus },
    setup: () => ({ args }),
    template: `
      <div class="h-60">
        <div class="flex w-64 items-center gap-1 border-b border-border bg-panel px-2 py-2">
          <span class="flex size-6 items-center justify-center rounded bg-accent text-2xs font-bold text-on-accent">P</span>
          <span class="min-w-0 flex-1 truncate px-1 text-xs text-surface">Homepage redesign</span>
          <CloudGuestStatus :can-edit-signed-in="args.canEditSignedIn" />
        </div>
      </div>`
  }),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('[data-state-sync]')
    if (trigger) await userEvent.click(trigger)
    await within(document.body).findByRole('dialog')
  }
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** An edit link the guest may only view: signing in lets them edit. */
export const EditLink: Story = {}

/** A view link: nothing more to offer a guest. */
export const ViewLink: Story = { args: { canEditSignedIn: false } }
