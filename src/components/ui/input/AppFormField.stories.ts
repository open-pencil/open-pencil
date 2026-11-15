import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import { ref } from 'vue'

import AppFormField from './AppFormField.vue'
import AppInput from './AppInput.vue'
import AppTextarea from './AppTextarea.vue'

const meta = {
  title: 'Design System/Inputs/Form Field'
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const fields = `
  <AppFormField label="Workspace name" hint="Everyone in the workspace sees it.">
    <template #default="{ id, describedBy }">
      <AppInput :id="id" v-model="name" :aria-describedby="describedBy" />
    </template>
  </AppFormField>
  <AppFormField label="Email" error="Enter an email address.">
    <template #default="{ id, invalid, describedBy }">
      <AppInput :id="id" v-model="email" type="email" :state="invalid ? 'invalid' : 'idle'" :aria-invalid="invalid || undefined" :aria-describedby="describedBy" />
    </template>
  </AppFormField>
  <AppFormField label="Reason">
    <template #default="{ id }"><AppTextarea :id="id" v-model="reason" :rows="2" /></template>
  </AppFormField>
`

/** A hint, an error in place of the hint, and a plain field, at the size dialogs use. */
export const Standard: Story = {
  render: () => ({
    components: { AppFormField, AppInput, AppTextarea },
    setup: () => ({ name: ref('Design'), email: ref('designer@'), reason: ref('') }),
    template: `<div class="flex max-w-sm flex-col gap-3 bg-panel p-6">${fields}</div>`
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const email = canvas.getByLabelText('Email')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Enter an email address.')
    await expect(canvas.getByLabelText('Workspace name')).toHaveAccessibleDescription(
      'Everyone in the workspace sees it.'
    )
  }
}

/** The larger size of a Cloud server's own sign-in pages. */
export const Large: Story = {
  render: () => ({
    components: { AppFormField, AppInput, AppTextarea },
    setup: () => ({ name: ref('Design'), email: ref('designer@'), reason: ref('') }),
    template: `<div class="flex max-w-sm flex-col gap-4 bg-panel p-6">${fields
      .replaceAll('<AppFormField ', '<AppFormField size="lg" ')
      .replaceAll('<AppInput ', '<AppInput size="lg" ')}</div>`
  })
}
