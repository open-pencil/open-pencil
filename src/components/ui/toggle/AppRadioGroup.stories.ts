import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ref } from 'vue'

import AppRadioGroup from './AppRadioGroup.vue'
import type { AppRadioOption } from './radio'

interface Args {
  label: string
  options: AppRadioOption<string>[]
  orientation?: 'vertical' | 'horizontal'
}

const options: AppRadioOption<string>[] = [
  { value: 'existing', label: 'Use my existing accounts only' },
  {
    value: 'metered',
    label: 'Include pay-as-you-go options',
    description: 'Requests are billed to the API account you connect.'
  },
  { value: 'later', label: 'Decide later', disabled: true }
]

const meta = {
  title: 'Design System/Inputs/Radio group',
  args: { label: 'Spending', options },
  render: (args) => ({
    components: { AppRadioGroup },
    setup: () => ({ args, value: ref('existing') }),
    template:
      '<div class="w-80 max-w-full"><AppRadioGroup v-bind="args" v-model="value" /><p class="mt-3 text-xs text-muted">Selected: {{ value }}</p></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>
export const Vertical: Story = {}
export const Horizontal: Story = {
  args: {
    orientation: 'horizontal',
    options: options.map(({ value, label }) => ({ value, label }))
  }
}
export const KeyboardSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const existing = canvas.getByRole('radio', { name: 'Use my existing accounts only' })
    const metered = canvas.getByRole('radio', { name: 'Include pay-as-you-go options' })
    await expect(metered).toHaveAccessibleDescription(
      'Requests are billed to the API account you connect.'
    )
    await expect(existing).toBeChecked()
    await userEvent.click(existing)
    // Reka checks the newly focused radio only while the arrow key is still held, as in a browser.
    async function pressArrow(key: string) {
      await userEvent.keyboard(`{${key}>}`)
      await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBeChecked())
      await userEvent.keyboard(`{/${key}}`)
    }
    await pressArrow('ArrowDown')
    await expect(metered).toBeChecked()
    await expect(canvas.getByText('Selected: metered')).toBeVisible()
    await pressArrow('ArrowRight')
    await expect(existing).toBeChecked()
    await pressArrow('ArrowLeft')
    await expect(metered).toBeChecked()
    await expect(canvas.getByRole('radio', { name: 'Decide later' })).toBeDisabled()
  }
}
