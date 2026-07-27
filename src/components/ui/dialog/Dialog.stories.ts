import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { DialogClose } from 'reka-ui'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import AppDialogBody from './AppDialogBody.vue'
import AppDialogFooter from './AppDialogFooter.vue'
import AppDialogHeader from './AppDialogHeader.vue'
import AppDialogRoot from './AppDialogRoot.vue'

const meta = {
  title: 'Design System/Dialog',
  component: AppDialogRoot,
  tags: ['autodocs']
} satisfies Meta<typeof AppDialogRoot>

export default meta
type Story = StoryObj<typeof meta>

export const Standard: Story = {
  render: () => ({
    components: {
      AppDialogBody,
      AppDialogFooter,
      AppDialogHeader,
      AppDialogRoot,
      DialogClose
    },
    setup() {
      const open = ref(false)
      return { open }
    },
    template: `
      <button type="button" @click="open = true">Open dialog</button>
      <AppDialogRoot v-model:open="open" size="sm">
        <AppDialogHeader
          heading="Integration settings"
          description="Configure a reusable provider."
          close-label="Close"
        />
        <AppDialogBody>
          <p class="text-xs text-surface">Dialog bodies scroll independently of their header and footer.</p>
        </AppDialogBody>
        <AppDialogFooter>
          <DialogClose as-child>
            <button type="button" class="rounded bg-accent px-3 py-1.5 text-xs text-white">Done</button>
          </DialogClose>
        </AppDialogFooter>
      </AppDialogRoot>
    `
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }))
    const body = within(document.body)
    await expect(body.getByRole('dialog')).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: 'Done' }))
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument()
  }
}
