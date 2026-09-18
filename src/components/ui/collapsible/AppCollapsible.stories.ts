import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'

import AppCollapsible from './AppCollapsible.vue'

const meta = {
  title: 'Design System/Disclosure/Collapsible',
  args: { label: 'Advanced settings' },
  render: (args) => ({
    components: { AppCollapsible, AppButton },
    setup: () => ({ args, open: ref(false) }),
    template: `
      <div class="max-w-md bg-panel p-4 text-surface">
        <AppCollapsible v-model:open="open" :label="args.label">
          <p class="pb-3 text-xs text-muted">Content inside the animated height wrapper.</p>
        </AppCollapsible>
      </div>`
  })
} satisfies Meta<{ label: string }>

export default meta
type Story = StoryObj<typeof meta>

export const Collapsed: Story = {}
export const OpenByDefault: Story = {
  render: (args) => ({
    components: { AppCollapsible },
    setup: () => ({ args, open: ref(true) }),
    template: `
      <div class="max-w-md bg-panel p-4 text-surface">
        <AppCollapsible v-model:open="open" :label="args.label">
          <p class="pb-3 text-xs text-muted">Visible on first render.</p>
        </AppCollapsible>
      </div>`
  })
}
export const WithActions: Story = {
  render: (args) => ({
    components: { AppCollapsible, AppButton },
    setup: () => ({ args, open: ref(false) }),
    template: `
      <div class="max-w-md bg-panel p-4 text-surface">
        <AppCollapsible v-model:open="open" :label="args.label">
          <template #actions><AppButton size="xs" variant="outline">Action</AppButton></template>
          <p class="pb-3 text-xs text-muted">Row action stays next to the trigger.</p>
        </AppCollapsible>
      </div>`
  })
}
export const Toggles: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Advanced settings' })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('Content inside the animated height wrapper.')).toBeVisible()
  }
}
