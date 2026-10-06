import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppBanner from './AppBanner.vue'

const meta = {
  title: 'Design System/Banner',
  component: AppBanner,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof AppBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Dismissible: Story = {
  render: () => ({
    components: { AppBanner },
    template: `
      <AppBanner storage-key="storybook-banner-dismissed">
        This display or browser cannot show Display-P3 colors, so the canvas previews them in sRGB.
        <template #dismiss>Dismiss</template>
      </AppBanner>
    `
  })
}

export const Persistent: Story = {
  render: () => ({
    components: { AppBanner },
    template: `<AppBanner>This banner cannot be dismissed.</AppBanner>`
  })
}
