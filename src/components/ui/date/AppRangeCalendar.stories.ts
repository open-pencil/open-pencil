import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import AppRangeCalendar from './AppRangeCalendar.vue'
import type { DayRange } from './range'

const meta = {
  title: 'Design System/Inputs/Range Calendar',
  render: () => ({
    components: { AppRangeCalendar },
    setup: () => ({ range: ref<DayRange | null>({ start: '2026-10-13', end: '2026-10-19' }) }),
    template: `
      <div class="w-72 bg-panel p-3 text-surface">
        <AppRangeCalendar v-model="range" label="Days" min="2026-09-22" max="2026-10-20" />
        <p class="mt-2 text-xs text-muted" data-testid="range">{{ range?.start }} – {{ range?.end }}</p>
      </div>`
  })
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Selected: Story = {}

/** A span is picked with two clicks; the model changes only once both ends are chosen. */
export const PickASpan: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /October 15, 2026/u }))
    await expect(canvas.getByTestId('range')).toHaveTextContent('2026-10-13 – 2026-10-19')
    await userEvent.click(canvas.getByRole('button', { name: /October 17, 2026/u }))
    await expect(canvas.getByTestId('range')).toHaveTextContent('2026-10-15 – 2026-10-17')
  }
}
