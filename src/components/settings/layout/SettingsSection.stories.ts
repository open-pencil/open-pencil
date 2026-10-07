import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import SettingsGroup from './SettingsGroup.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'

interface Args {
  heading: string
  description?: string
  actionLabel?: string
}

const meta = {
  title: 'App/Settings/Layout/Section',
  component: SettingsSection,
  args: { heading: 'Recovery' },
  render: (args) => ({
    components: { SettingsSection, SettingsGroup, SettingsRow, AppSwitch, AppButton },
    setup: () => ({ args }),
    template: `
      <div class="max-w-xl">
        <SettingsSection>
          <template #title>{{ args.heading }}</template>
          <template v-if="args.description" #description>{{ args.description }}</template>
          <template v-if="args.actionLabel" #actions><AppButton variant="outline">{{ args.actionLabel }}</AppButton></template>
          <SettingsGroup>
            <SettingsRow label="Preserve unsaved work" description="Keep local recovery copies of your documents.">
              <AppSwitch :model-value="true" label="Preserve unsaved work" />
            </SettingsRow>
          </SettingsGroup>
        </SettingsSection>
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithAction: Story = { args: { actionLabel: 'Configure' } }
export const WithDescription: Story = {
  args: { description: 'Restore your documents after an unexpected shutdown.' }
}
