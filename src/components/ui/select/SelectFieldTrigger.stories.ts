import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { computed, ref } from 'vue'

import { BindingTrigger } from '@/components/ui/binding'
import { panelFieldBase } from '@/theme/panel/field/base'

import AppSelectContent from './AppSelectContent.vue'
import AppSelectItem from './AppSelectItem.vue'
import AppSelectRoot from './AppSelectRoot.vue'
import SelectFieldTrigger from './SelectFieldTrigger.vue'

const LABEL = 'Width'

const meta = {
  title: 'Design System/Selection/Field Trigger',
  args: { initial: 'FIXED' },
  render: (args) => ({
    components: {
      AppSelectRoot,
      AppSelectContent,
      AppSelectItem,
      SelectFieldTrigger,
      BindingTrigger
    },
    setup: () => {
      const sizing = ref(args.initial)
      // A fixed size needs no word beside the chevron: the field's number already says it.
      const text = computed(() => ({ FIXED: undefined, HUG: 'Hug', FILL: 'Fill' })[sizing.value])
      return { sizing, text, field: [panelFieldBase, 'flex w-52 items-center pe-0.5 text-2xs'] }
    },
    template: `
      <div class="bg-panel p-4 text-surface">
        <div :class="field">
          <span class="px-1.25 text-muted">W</span>
          <span class="min-w-0 flex-1 truncate tabular-nums">880</span>
          <AppSelectRoot v-model="sizing">
            <SelectFieldTrigger label="${LABEL}" :text="text" />
            <AppSelectContent align="end">
              <AppSelectItem value="FIXED">Fixed</AppSelectItem>
              <AppSelectItem value="HUG">Hug</AppSelectItem>
              <AppSelectItem value="FILL">Fill</AppSelectItem>
            </AppSelectContent>
          </AppSelectRoot>
          <BindingTrigger label="Apply variable" />
        </div>
      </div>`
  })
} satisfies Meta<{ initial: 'FIXED' | 'HUG' | 'FILL' }>

export default meta
type Story = StoryObj<typeof meta>

/** A fixed size: the chevron alone, on the variable button's rhythm. */
export const Bare: Story = {}

/** A hugging size names its mode beside the chevron. */
export const Labelled: Story = { args: { initial: 'HUG' } }

/** Choosing a mode from the list shows it on the trigger. */
export const ChooseMode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('combobox', { name: LABEL })
    await userEvent.click(trigger)
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Fill' }))
    await expect(trigger).toHaveTextContent('Fill')
  }
}
