import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import type { PagePresenceEntry } from '@/app/presence/registry'

import PresenceMarkers from './PresenceMarkers.vue'

const ana = { r: 0.92, g: 0.34, b: 0.29, a: 1 }
const ben = { r: 0.2, g: 0.55, b: 0.95, a: 1 }
const you = { r: 0.3, g: 0.7, b: 0.45, a: 1 }

const anaWithAgent: PagePresenceEntry[] = [
  { id: 'person:ana', kind: 'person', name: 'Ana', color: ana },
  { id: 'agent:orbit', kind: 'agent', name: 'Orbit', color: ana }
]

type Args = { entries: PagePresenceEntry[] }

const meta = {
  title: 'App/Collaboration/Page Presence Markers',
  component: PresenceMarkers,
  tags: ['autodocs'],
  args: { entries: anaWithAgent },
  render: (args) => ({
    components: { PresenceMarkers },
    setup: () => ({ args }),
    template:
      '<div class="flex w-56 items-center gap-2 bg-panel p-3 text-xs text-surface"><span class="flex-1">Checkout</span><PresenceMarkers v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Person: Story = {
  args: { entries: [{ id: 'person:ben', kind: 'person', name: 'Ben', color: ben }] }
}

export const PersonAndTheirAgent: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img')).toHaveAccessibleName('Ana, Orbit')
  }
}

export const YourAgent: Story = {
  args: { entries: [{ id: 'agent:fern', kind: 'agent', name: 'Fern', color: you }] }
}

export const MoreThanFit: Story = {
  args: {
    entries: [
      ...anaWithAgent,
      { id: 'person:ben', kind: 'person', name: 'Ben', color: ben },
      { id: 'agent:pixel', kind: 'agent', name: 'Pixel', color: ben },
      { id: 'agent:fern', kind: 'agent', name: 'Fern', color: you }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('+2')).toBeVisible()
    await expect(canvas.getByRole('img')).toHaveAccessibleName('Ana, Orbit, Ben, Pixel, Fern')
  }
}

export const Nobody: Story = {
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).toBeNull()
  }
}
