import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CloudDraftSaveDialog from './CloudDraftSaveDialog.vue'

type Args = { host: string }

const meta = {
  title: 'App/Cloud/Keep This File',
  tags: ['autodocs'],
  args: { host: 'cloud.openpencil.dev' },
  render: (args) => ({
    components: { CloudDraftSaveDialog },
    setup: () => ({ args }),
    template: '<div class="h-80"><CloudDraftSaveDialog :open="true" :host="args.host" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** Save without an account on the official server's editor. */
export const Official: Story = {}

/** A team's own server names itself. */
export const SelfHosted: Story = { args: { host: 'design.acme.dev' } }
