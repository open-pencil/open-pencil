import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { computed, ref } from 'vue'

import CapabilityList from './CapabilityList.vue'
import type { CapabilityGroup, CapabilityItem } from './types'

function items(prefix: string, count: number, description: string): CapabilityItem[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${prefix}_${index + 1}`,
    name: `${prefix}_${index + 1}`,
    description,
    enabled: true
  }))
}

const reads = items(
  'inspect_component',
  60,
  'Inspect a component and its properties in the active document. Narrow the selection to inspect fewer layers.'
)
const writes = items('edit_component', 20, 'Change a property on one or more components.')

type Args = {
  disabled: string[]
  collapsed: boolean
  onOpen?: (group: string, item: string) => void
}

const meta = {
  title: 'App/Settings/Capability List',
  args: { disabled: [], collapsed: false },
  render: (args) => ({
    components: { CapabilityList },
    setup: () => {
      const disabled = ref([...args.disabled])
      const expanded = ref<Record<string, boolean>>({ read: !args.collapsed, write: false })
      const groups = computed<CapabilityGroup[]>(() =>
        [
          { key: 'read', label: 'Read-only', members: reads },
          { key: 'write', label: 'Changes', members: writes }
        ].map(({ key, label, members }) => {
          const on = members.filter((item) => !disabled.value.includes(item.key)).length
          return {
            key,
            label,
            toggle: { enabled: on > 0, state: on > 0 && on < members.length ? 'mixed' : 'idle' },
            items: members.map((item) => ({ ...item, enabled: !disabled.value.includes(item.key) }))
          }
        })
      )
      function setGroup(key: string, enabled: boolean) {
        const keys = (key === 'read' ? reads : writes).map((item) => item.key)
        disabled.value = enabled
          ? disabled.value.filter((name) => !keys.includes(name))
          : [...disabled.value, ...keys]
      }
      function setItem(_group: string, key: string, enabled: boolean) {
        disabled.value = enabled
          ? disabled.value.filter((name) => name !== key)
          : [...disabled.value, key]
      }
      return { groups, expanded, setGroup, setItem }
    },
    template: `
      <div class="max-w-lg bg-panel p-3 text-surface">
        <CapabilityList
          :groups="groups"
          :expanded="expanded"
          @update:expanded="(key, open) => (expanded = { ...expanded, [key]: open })"
          @set-group="setGroup"
          @set-item="setItem"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const LongCatalog: Story = {}
export const MixedAccess: Story = { args: { disabled: ['inspect_component_1'] } }
export const CollapsedGroup: Story = { args: { collapsed: true } }
export const ToggleAccess: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: 'inspect_component_1' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Changes' }))
    await expect(canvas.getByRole('switch', { name: 'edit_component_1' })).toBeVisible()
  }
}

const skillGroups: CapabilityGroup[] = [
  {
    key: 'uploads',
    label: 'Uploaded',
    toggle: { enabled: true, state: 'idle' },
    items: [],
    empty: 'No uploaded skills yet.'
  },
  {
    key: 'project',
    label: 'Next to this document',
    detail: '~/site/design/.agents/skills',
    toggle: null,
    items: [
      {
        key: 'grid',
        name: 'grid',
        description: 'Lay out pages on an eight-point grid.',
        enabled: false,
        locked: true,
        note: 'Not trusted'
      }
    ]
  },
  {
    key: 'agents',
    label: 'Shared agent skills',
    detail: '~/.agents/skills',
    toggle: { enabled: true, state: 'idle' },
    items: [
      {
        key: 'brand-review',
        name: 'brand-review',
        description: 'Check a layout against the brand guide.',
        enabled: true,
        note: 'Not used'
      }
    ]
  }
]

/** Skills: a source without its own switch, an empty one, details to open, and notes. */
export const Openable: Story = {
  args: { onOpen: fn() },
  render: (args) => ({
    components: { CapabilityList },
    setup: () => ({ args, groups: skillGroups, expanded: {} }),
    template: `
      <div class="max-w-lg bg-panel p-3 text-surface">
        <CapabilityList
          :groups="groups"
          :expanded="expanded"
          :open-label="(item) => 'Show ' + item.name"
          @open="args.onOpen"
        >
          <template #group-actions="{ group }">
            <button v-if="group.key === 'project'" type="button" class="text-xs">Trust folder</button>
          </template>
        </CapabilityList>
      </div>`
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Show brand-review' }))
    await expect(args.onOpen).toHaveBeenCalledWith('agents', 'brand-review')
    await expect(canvas.getByRole('switch', { name: 'grid' })).toBeDisabled()
  }
}
