import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { computed, ref } from 'vue'

import type { ToolAccessEntry, ToolAccessGroup } from '@/app/automation/tool-access/types'

import ToolAccessList from './ToolAccessList.vue'

const entries: ToolAccessEntry[] = Array.from({ length: 60 }, (_, index) => ({
  name: `inspect_component_${index + 1}`,
  description:
    'Inspect a component and its properties in the active document. Narrow the selection to inspect fewer layers.',
  effect: 'read'
}))
const writeEntries: ToolAccessEntry[] = Array.from({ length: 20 }, (_, index) => ({
  name: `edit_component_${index + 1}`,
  description: 'Change a property on one or more components.',
  effect: 'write'
}))

const meta = {
  title: 'Settings/Tool access/List',
  args: {
    disabledTools: [] as string[],
    initiallyCollapsed: false,
    labels: ['Read-only', 'Changes']
  },
  render: (args) => ({
    components: { ToolAccessList },
    setup: () => {
      const disabled = ref([...args.disabledTools])
      const expanded = ref({ read: !args.initiallyCollapsed, write: false })
      const all = [...entries, ...writeEntries]
      const groups = computed<ToolAccessGroup[]>(() =>
        (['read', 'write'] as const).map((effect) => {
          const tools = all.filter((tool) => tool.effect === effect)
          const enabled = tools.filter((tool) => !disabled.value.includes(tool.name)).length
          return {
            effect,
            label: effect === 'read' ? args.labels[0] : args.labels[1],
            enabled: enabled > 0,
            state: enabled > 0 && enabled < tools.length ? 'mixed' : 'idle',
            tools
          }
        })
      )
      const isEnabled = (tool: ToolAccessEntry) => !disabled.value.includes(tool.name)
      return { args, disabled, expanded, groups, isEnabled }
    },
    template: `
      <div class="max-w-lg bg-panel p-3 text-surface">
        <ToolAccessList
          :groups="groups"
          :expanded="expanded"
          :is-enabled="isEnabled"
          @update:expanded="(effect, open) => (expanded = { ...expanded, [effect]: open })"
          @set-group="(effect, enabled) => (disabled = enabled
            ? disabled.filter((name) => !groups.find((g) => g.effect === effect).tools.some((t) => t.name === name))
            : [...disabled, ...groups.find((g) => g.effect === effect).tools.map((t) => t.name)])"
          @set-tool="(name, enabled) => (disabled = enabled ? disabled.filter((n) => n !== name) : [...disabled, name])"
        />
      </div>`
  })
} satisfies Meta<{ disabledTools: string[]; initiallyCollapsed: boolean; labels: [string, string] }>

export default meta
type Story = StoryObj<typeof meta>

export const LongCatalog: Story = {}
export const MixedAccess: Story = { args: { disabledTools: ['inspect_component_1'] } }
export const CollapsedGroup: Story = { args: { initiallyCollapsed: true } }
export const ToggleAccess: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: 'inspect_component_1' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Changes' }))
    await expect(canvas.getByRole('switch', { name: 'edit_component_1' })).toBeVisible()
  }
}
