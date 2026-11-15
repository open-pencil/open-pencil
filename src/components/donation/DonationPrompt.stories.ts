import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import { donationPrompt } from '@/app/donation'
import { appPreferences } from '@/app/settings/preferences/store'

import DonationPrompt from './DonationPrompt.vue'

const meta = {
  title: 'App/Shell/Donation Prompt',
  component: DonationPrompt,
  render: () => ({
    components: { DonationPrompt },
    setup() {
      donationPrompt.value = true
      return {}
    },
    template: '<div class="h-60"><DonationPrompt /></div>'
  })
} satisfies Meta<typeof DonationPrompt>

export default meta
type Story = StoryObj<typeof meta>

export const Asking: Story = {}

/** Not now closes the card and asks again later. */
export const NotNow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Not now' }))
    await expect(canvas.queryByRole('complementary')).toBeNull()
    await expect(appPreferences.value.donation.promptAfter).toBeGreaterThan(Date.now())
  }
}
