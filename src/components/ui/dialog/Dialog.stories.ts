import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import AppButton from '@/components/ui/AppButton.vue'

import AppConfirmationDialog from './AppConfirmationDialog.vue'
import AppDialog from './AppDialog.vue'
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
    components: { AppDialogBody, AppDialogFooter, AppDialogHeader, AppDialogRoot, AppButton },
    setup() {
      const open = ref(false)
      return { open }
    },
    template: `
      <AppButton @click="open = true">Open dialog</AppButton>
      <AppDialogRoot v-model:open="open" size="sm">
        <AppDialogHeader heading="Integration settings" description="Configure a reusable provider." close-label="Close" />
        <AppDialogBody><p class="text-xs text-surface">Dialog content.</p></AppDialogBody>
        <AppDialogFooter><AppButton color="primary" @click="open = false">Done</AppButton></AppDialogFooter>
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

export const Confirmation: Story = {
  render: () => ({
    components: { AppButton, AppConfirmationDialog },
    setup() {
      const open = ref(false)
      return { open }
    },
    template: `
      <AppButton color="error" @click="open = true">Clear diagnostics</AppButton>
      <AppConfirmationDialog v-model:open="open" heading="Clear diagnostics" description="Remove local diagnostics from this device?" cancel-label="Cancel" confirm-label="Clear" tone="danger" />
    `
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Clear diagnostics' }))
    const body = within(document.body)
    await expect(body.getByRole('alertdialog')).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }))
    await expect(body.queryByRole('alertdialog')).not.toBeInTheDocument()
  }
}

export const SemanticWrapper: Story = {
  render: () => ({
    components: { AppButton, AppDialog },
    setup() {
      const open = ref(false)
      return { open }
    },
    template: `
      <AppButton @click="open = true">Open semantic dialog</AppButton>
      <AppDialog v-model:open="open">
        <template #header>
          <AppDialogHeader heading="Semantic dialog" description="Composed with the shared wrapper." close-label="Close" />
        </template>
        <p class="text-xs text-surface">Content slot.</p>
        <template #footer><AppButton color="primary" @click="open = false">Done</AppButton></template>
      </AppDialog>
    `
  })
}
