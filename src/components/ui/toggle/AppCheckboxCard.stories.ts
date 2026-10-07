import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import AppCheckboxCard from './AppCheckboxCard.vue'

interface Args {
  label: string
  description?: string
  disabled?: boolean
}

const meta = {
  title: 'Design System/Inputs/Checkbox Card',
  args: {
    label: 'Review designs visually',
    description: 'A model that reads images checks the result against your request.'
  },
  render: (args) => ({
    components: { AppCheckboxCard },
    setup: () => ({ args, checked: ref(false) }),
    template:
      '<div class="flex w-80 max-w-full flex-col gap-2 bg-panel p-4"><AppCheckboxCard v-bind="args" v-model="checked" /><p class="text-xs text-muted">Checked: {{ checked }}</p></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const checkbox = canvas.getByRole('checkbox', { name: args.label })
    await expect(checkbox).toHaveAccessibleDescription(args.description ?? '')
    await userEvent.click(canvas.getByText(args.label))
    await expect(checkbox).toBeChecked()
  }
}
export const WithoutDescription: Story = { args: { description: undefined } }
export const Disabled: Story = { args: { disabled: true } }
