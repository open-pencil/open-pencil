import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { onUnmounted } from 'vue'

import { accentPreference } from '@/app/shell/accent'
import { DEFAULT_ACCENT, type AccentPreference } from '@/app/shell/accent/palette'

import AccentColorPicker from './AccentColorPicker.vue'

type Args = { accent: AccentPreference }

const meta = {
  title: 'App/Settings/Accent Color',
  args: { accent: { ...DEFAULT_ACCENT } },
  render: (args) => ({
    components: { AccentColorPicker },
    setup() {
      // The picker edits the app's stored accent; each story sets it and puts the default back.
      accentPreference.value = { ...args.accent }
      onUnmounted(() => {
        accentPreference.value = { ...DEFAULT_ACCENT }
      })
      return {}
    },
    template: '<div class="flex max-w-lg justify-end bg-panel p-4"><AccentColorPicker /></div>'
  })
} satisfies Meta<Args>
export default meta
type Story = StoryObj<typeof meta>

export const Preset: Story = {}

export const Custom: Story = {
  args: { accent: { kind: 'custom', color: '#0F766E' } }
}

export const ChoosingAPreset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const presets = canvas.getByRole('radiogroup')
    const [, second] = within(presets).getAllByRole('radio')
    await userEvent.click(second)
    await expect(second).toHaveAttribute('data-state', 'checked')
    await expect(canvas.getByTestId('settings-accent-custom')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  }
}
