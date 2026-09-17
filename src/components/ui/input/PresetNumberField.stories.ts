import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { computed, ref } from 'vue'

import PresetNumberField from './PresetNumberField.vue'

const LABEL = 'Maximum steps per message'

const meta = {
  title: 'Design System/Inputs/Preset number',
  args: {
    presets: [25, 50, 100, 200],
    min: 1,
    max: 1000,
    label: 'Maximum steps per message',
    customLabel: 'Custom…',
    rangeMessage: 'Enter a whole number from 1 to 1000.',
    initial: 50
  },
  render: (args) => ({
    components: { PresetNumberField },
    setup: () => {
      const value = ref(args.initial)
      const shown = computed(() => `Committed value: ${value.value}`)
      return { args, value, shown }
    },
    template: `
      <div class="flex max-w-md flex-col gap-2 bg-panel p-4 text-surface">
        <PresetNumberField
          v-model:number="value"
          :presets="args.presets"
          :min="args.min"
          :max="args.max"
          :label="args.label"
          :custom-label="args.customLabel"
          :range-message="args.rangeMessage"
        />
        <p data-testid="committed" class="text-xs text-muted">{{ shown }}</p>
      </div>`
  })
} satisfies Meta<{
  presets: number[]
  min: number
  max: number
  label: string
  customLabel: string
  rangeMessage: string
  initial: number
}>

export default meta
type Story = StoryObj<typeof meta>

export const PresetSelected: Story = {}
export const CustomSelected: Story = { args: { initial: 137 } }
export const Disabled: Story = {
  render: (args) => ({
    components: { PresetNumberField },
    setup: () => ({ args, value: ref(args.initial) }),
    template: `
      <div class="max-w-md bg-panel p-4 text-surface">
        <PresetNumberField
          v-model:number="value"
          :presets="args.presets"
          :min="args.min"
          :max="args.max"
          :label="args.label"
          :custom-label="args.customLabel"
          :range-message="args.rangeMessage"
          disabled
        />
      </div>`
  })
}

/** Open the preset list and choose the escape hatch for this story's field. */
async function chooseCustom(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('combobox', { name: LABEL }))
  await userEvent.click(within(document.body).getByRole('option', { name: 'Custom…' }))
  // The revealed field is named after the control plus the custom option.
  return canvas.getByRole('spinbutton', { name: `${LABEL}: Custom…` })
}

/** Choosing the escape hatch reveals a field seeded from the current value. */
export const RevealsCustomField: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('spinbutton', { name: LABEL })).toBeNull()
    const field = await chooseCustom(canvasElement)
    await expect(field).toHaveValue(50)
  }
}

/** An out-of-range draft reports the range and leaves the committed value alone. */
export const RejectsOutOfRange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = await chooseCustom(canvasElement)
    await userEvent.clear(field)
    await userEvent.type(field, '0')
    await userEvent.tab()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByText('Enter a whole number from 1 to 1000.')).toBeVisible()
    await expect(canvas.getByTestId('committed')).toHaveTextContent('Committed value: 50')
  }
}

/** A value replaced from outside the control switches to custom mode. */
export const FollowsExternalValue: Story = {
  render: (args) => ({
    components: { PresetNumberField },
    setup: () => {
      const value = ref(args.initial)
      return { args, value }
    },
    template: `
      <div class="flex max-w-md flex-col gap-2 bg-panel p-4 text-surface">
        <PresetNumberField
          v-model:number="value"
          :presets="args.presets"
          :min="args.min"
          :max="args.max"
          :label="args.label"
          :custom-label="args.customLabel"
          :range-message="args.rangeMessage"
        />
        <button type="button" @click="value = 137">Set externally</button>
      </div>`
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('spinbutton')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Set externally' }))
    const field = canvas.getByRole('spinbutton', { name: `${LABEL}: Custom…` })
    await expect(field).toHaveValue(137)
  }
}

/** A valid custom value commits on Enter and is reported to the owner. */
export const CommitsCustomValue: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = await chooseCustom(canvasElement)
    await userEvent.clear(field)
    await userEvent.type(field, '137{Enter}')
    await expect(field).toHaveAttribute('aria-invalid', 'false')
    await expect(canvas.getByTestId('committed')).toHaveTextContent('Committed value: 137')
  }
}
