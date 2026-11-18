import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import GapIcon from '~icons/lucide/align-horizontal-space-between'
import SlotIcon from '~icons/lucide/square-dashed'

import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'
import AppSelectRoot from '@/components/ui/select/AppSelectRoot.vue'
import SelectFieldTrigger from '@/components/ui/select/SelectFieldTrigger.vue'

import PanelField from './PanelField.vue'

const meta = {
  title: 'Design System/Layout/Panel Field',
  render: () => ({
    components: {
      PanelField,
      AppSelectRoot,
      AppSelectContent,
      AppSelectItem,
      SelectFieldTrigger,
      GapIcon,
      SlotIcon
    },
    setup: () => ({ gap: ref('AUTO') }),
    template: `
      <div class="flex w-56 flex-col gap-2 bg-panel p-4 text-surface">
        <PanelField>
          <template #leading><GapIcon class="size-3.5" /></template>
          Auto
          <template #trailing>
            <AppSelectRoot v-model="gap">
              <SelectFieldTrigger label="Gap" />
              <AppSelectContent align="end">
                <AppSelectItem value="FIXED">8</AppSelectItem>
                <AppSelectItem value="AUTO">Auto</AppSelectItem>
              </AppSelectContent>
            </AppSelectRoot>
          </template>
        </PanelField>
        <PanelField>
          <template #leading><SlotIcon class="size-3.5 text-slot" /></template>
          <span class="truncate text-muted">Default</span>
          <span class="ms-auto shrink-0 text-muted">2 items</span>
        </PanelField>
        <PanelField>2x</PanelField>
      </div>`
  })
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A value with an icon and a mode menu, one with only an icon, and a bare value. */
export const Parts: Story = {}
