import type { Meta, StoryObj } from '@storybook/vue3-vite'
import IconShare from '~icons/lucide/share-2'
import IconUndo from '~icons/lucide/undo-2'

import HudButton from './HudButton.vue'

const meta = {
  title: 'Editor/Mobile HUD/Actions',
  render: () => ({
    components: { HudButton, IconUndo, IconShare },
    template: `<div class="flex items-center gap-2 bg-canvas p-6">
      <HudButton icon-only label="Undo"><IconUndo class="size-3.5" /></HudButton>
      <HudButton label="Share"><template #leading><IconShare class="size-3.5" /></template></HudButton>
      <HudButton icon-only label="Unavailable undo" disabled><IconUndo class="size-3.5" /></HudButton>
    </div>`
  })
} satisfies Meta
export default meta
export const Default: StoryObj<typeof meta> = {}
