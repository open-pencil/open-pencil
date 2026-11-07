import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import AISetupWelcome from './AISetupWelcome.vue'

interface Args {
  offersTour?: boolean
  tourOpening?: boolean
  tourFailed?: boolean
}

const meta = {
  title: 'App/Settings/AI Setup/Welcome',
  args: { offersTour: true },
  render: (args) => ({
    components: { AISetupWelcome },
    setup: () => ({ args }),
    template:
      '<div class="flex w-[34rem] max-w-full flex-col gap-3 text-xs"><AISetupWelcome v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

const page = () => within(document.body)

export const Default: Story = {}

/** Offered over the demo, which is the tour, so it does not point to it. */
export const WithoutTour: Story = {
  args: { offersTour: false },
  play: async () => {
    await expect(page().queryByRole('button', { name: 'Open the tour' })).toBeNull()
  }
}

export const TourOpening: Story = {
  args: { tourOpening: true },
  play: async () => {
    await expect(page().getByRole('button', { name: 'Open the tour' })).toBeDisabled()
  }
}

/** The tour could not load; the welcome stays so the person can try again. */
export const TourFailed: Story = {
  args: { tourFailed: true },
  play: async () => {
    await expect(page().getByRole('alert')).toHaveTextContent('The tour could not be opened.')
    await expect(page().getByRole('button', { name: 'Open the tour' })).toBeEnabled()
  }
}

/** A phone-width section: the button moves under the text instead of overflowing. */
export const Narrow: Story = {
  render: (args) => ({
    components: { AISetupWelcome },
    setup: () => ({ args }),
    template:
      '<div class="flex w-[16rem] flex-col gap-3 text-xs"><AISetupWelcome v-bind="args" /></div>'
  })
}
