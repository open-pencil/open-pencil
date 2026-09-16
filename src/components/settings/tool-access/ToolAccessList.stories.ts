import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import type { ToolDescriptor } from '@open-pencil/mcp/tools'
import { useAutomationMessages } from '@open-pencil/vue'

import ToolAccessList from './ToolAccessList.vue'

const tools: ToolDescriptor[] = Array.from({ length: 80 }, (_, index) => ({
  name: `inspect_component_${index + 1}`,
  description:
    'Inspect a component and its properties in the active document. Narrow the selection to inspect fewer layers.',
  effect: 'read',
  availability: 'default',
  capabilities: ['document:read'],
  enabled: true
}))
const meta = {
  title: 'Settings/Automation/Tool access',
  args: { tools, disabledTools: [], externallyManaged: false },
  render: (args) => ({
    components: { ToolAccessList },
    setup: () => ({
      args,
      disabled: ref([...args.disabledTools]),
      automation: useAutomationMessages()
    }),
    template: `
      <div class="flex h-96 max-w-lg bg-panel">
        <ToolAccessList :tools="args.tools" v-model:disabled-tools="disabled" @reset="disabled = []">
          <template #footer>{{ args.externallyManaged ? automation.externalRestartNotice : automation.toolsRestartNotice }}</template>
        </ToolAccessList>
      </div>`
  })
} satisfies Meta<{ tools: ToolDescriptor[]; disabledTools: string[]; externallyManaged: boolean }>
export default meta
type Story = StoryObj<typeof meta>
export const LongCatalog: Story = {}
export const MixedAccess: Story = { args: { disabledTools: ['inspect_component_1'] } }
export const EmptySearch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('searchbox'), 'no-matching-tool')
    await expect(canvas.getByText('No tools match your search.')).toBeVisible()
  }
}
export const ExternallyManaged: Story = { args: { externallyManaged: true } }
export const ToggleAccess: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: 'inspect_component_1' }))
    await expect(canvas.getByText('79 of 80 enabled')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Restore defaults' }))
    await expect(canvas.getByText('80 of 80 enabled')).toBeVisible()
  }
}
