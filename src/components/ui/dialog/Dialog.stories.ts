import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { useHeldContent } from '@/components/ui/overlay/held'

import AppConfirmationDialog from './AppConfirmationDialog.vue'
import AppDialog from './AppDialog.vue'
import AppDialogBody from './AppDialogBody.vue'
import AppDialogFooter from './AppDialogFooter.vue'
import AppDialogHeader from './AppDialogHeader.vue'
import AppDialogRoot from './AppDialogRoot.vue'
import AppFormDialog from './AppFormDialog.vue'

const meta = {
  title: 'Design System/Overlays/Dialog',
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

/**
 * A confirmation whose `open` follows a target that closing clears, as a list's remove action
 * does. The dialog keeps naming the target while it animates closed.
 */
export const TargetedConfirmation: Story = {
  render: () => ({
    components: { AppButton, AppConfirmationDialog },
    setup() {
      const removing = ref<{ name: string; unsaved: boolean } | null>(null)
      const shown = useHeldContent(removing)
      return { removing, shown }
    },
    template: `
      <div class="flex gap-2">
        <AppButton @click="removing = { name: 'Alpha', unsaved: true }">Remove Alpha</AppButton>
        <AppButton @click="removing = { name: 'Beta', unsaved: false }">Remove Beta</AppButton>
      </div>
      <AppConfirmationDialog
        :open="removing !== null"
        tone="danger"
        :heading="'Remove ' + (shown?.name ?? '')"
        :description="shown?.unsaved ? 'Unsaved changes will be lost.' : 'This cannot be undone.'"
        cancel-label="Cancel"
        :confirm-label="shown?.unsaved ? 'Discard and remove' : 'Remove'"
        @update:open="(open) => !open && (removing = null)"
      />
    `
  })
}

/**
 * A dialog that is one form: it opens on its field, an empty name is caught in place and takes
 * focus back, Enter submits, and a failed submit shows why under the fields. The name starts empty each time it opens.
 */
export const Form: Story = {
  render: () => ({
    components: { AppButton, AppFormDialog, AppFormField, AppInput },
    setup() {
      const open = ref(false)
      const name = ref('')
      const invalid = ref<string | null>(null)
      const failed = ref<string | null>(null)
      function reset() {
        name.value = ''
        invalid.value = null
        failed.value = null
      }
      function submit() {
        invalid.value = name.value.trim() ? null : 'Enter a name.'
        if (!invalid.value) failed.value = 'The server could not be reached.'
      }
      return { open, name, invalid, failed, reset, submit }
    },
    template: `
      <AppButton @click="open = true">Rename workspace</AppButton>
      <AppFormDialog
        v-model:open="open"
        heading="Rename workspace"
        description="Everyone in the workspace sees the new name."
        close-label="Close"
        cancel-label="Cancel"
        submit-label="Rename"
        :error="failed"
        error-heading="Couldn't rename the workspace"
        @open="reset"
        @submit="submit"
      >
        <AppFormField label="Name" :error="invalid">
          <template #default="{ id, invalid: hasError, describedBy }">
            <AppInput :id="id" v-model="name" autofocus :state="hasError ? 'invalid' : 'idle'" :aria-invalid="hasError || undefined" :aria-describedby="describedBy" />
          </template>
        </AppFormField>
      </AppFormDialog>
    `
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Rename workspace' }))
    const name = await body.findByLabelText('Name')
    await expect(name).toHaveFocus()
    // Submitting from the button leaves focus on it, until the invalid field takes it back.
    await userEvent.click(body.getByRole('button', { name: 'Rename' }))
    await expect(name).toHaveAccessibleDescription('Enter a name.')
    await waitFor(() => expect(name).toHaveFocus())
    await userEvent.type(name, 'Design{Enter}')
    await expect(body.getByText('The server could not be reached.')).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }))
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Rename workspace' }))
    await expect(await body.findByLabelText('Name')).toHaveValue('')
  }
}

/**
 * Deleting something that can't be brought back waits for its name, typed in any letter case;
 * Enter confirms once it matches.
 */
export const TypedConfirmation: Story = {
  render: () => ({
    components: { AppButton, AppConfirmationDialog },
    setup() {
      const open = ref(false)
      const deleted = ref(false)
      return { open, deleted }
    },
    template: `
      <AppButton color="error" @click="open = true">Delete workspace</AppButton>
      <p v-if="deleted" class="mt-2 text-xs text-surface">Deleted</p>
      <AppConfirmationDialog
        v-model:open="open"
        tone="danger"
        heading="Delete Design team?"
        description="Its files go to the trash for everyone."
        cancel-label="Cancel"
        confirm-label="Delete workspace"
        confirm-text="Design team"
        @confirm="deleted = true"
      />
    `
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Delete workspace' }))
    const dialog = within(await body.findByRole('alertdialog'))
    const confirm = dialog.getByRole('button', { name: 'Delete workspace' })
    await expect(confirm).toBeDisabled()
    const typed = dialog.getByLabelText('To confirm, type “Design team”.')
    await userEvent.type(typed, 'design')
    await expect(confirm).toBeDisabled()
    await userEvent.type(typed, ' TEAM {Enter}')
    await expect(canvas.getByText('Deleted')).toBeVisible()
  }
}

/**
 * Actions sit at the end, Cancel first and the main action last; a separate action, here Delete,
 * goes in the footer's start slot. A footer's `ui` can restyle it but not move its actions.
 */
export const FooterStartAction: Story = {
  render: () => ({
    components: { AppButton, AppDialogBody, AppDialogFooter, AppDialogHeader, AppDialogRoot },
    setup() {
      const open = ref(false)
      return { open }
    },
    template: `
      <AppButton @click="open = true">Edit connection</AppButton>
      <AppDialogRoot v-model:open="open" size="sm">
        <AppDialogHeader heading="Edit connection" close-label="Close" />
        <AppDialogBody><p class="text-xs text-surface">Connection settings.</p></AppDialogBody>
        <AppDialogFooter :ui="{ footer: 'justify-between' }">
          <template #start><AppButton color="error" variant="link">Delete</AppButton></template>
          <AppButton @click="open = false">Cancel</AppButton>
          <AppButton color="primary" variant="solid" @click="open = false">Save</AppButton>
        </AppDialogFooter>
      </AppDialogRoot>
    `
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit connection' }))
    const dialog = within(await within(document.body).findByRole('dialog'))
    const footer = dialog.getByRole('button', { name: 'Save' }).closest('footer')
    await expect(footer).toHaveClass('justify-end')
    await expect(footer).not.toHaveClass('justify-between')
    const cancel = dialog.getByRole('button', { name: 'Cancel' }).getBoundingClientRect()
    const save = dialog.getByRole('button', { name: 'Save' }).getBoundingClientRect()
    const remove = dialog.getByRole('button', { name: 'Delete' }).getBoundingClientRect()
    await expect(remove.right).toBeLessThan(cancel.left)
    await expect(cancel.right).toBeLessThan(save.left)
  }
}
