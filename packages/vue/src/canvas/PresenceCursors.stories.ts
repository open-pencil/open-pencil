import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PresenceCursors from './examples/PresenceCursors.vue'

type Args = {
  person: string
  personColor: string
  agent: string
  otherAgent: string
  otherColor: string
  zoom: number
}

const meta = {
  title: 'Vue SDK/Canvas/Presence Cursors',
  component: PresenceCursors,
  parameters: {
    docs: {
      description: {
        component:
          'People draw as arrows filled with their color; agents in the color of the person running them, with an outlined label that starts with a sparkle, and what they edit outlined.'
      }
    }
  },
  args: {
    person: 'Ana',
    personColor: '#eb574a',
    agent: 'Fern',
    otherAgent: 'Orbit',
    otherColor: '#338cf2',
    zoom: 1
  },
  argTypes: {
    personColor: { control: 'color' },
    otherColor: { control: 'color' },
    zoom: { control: { type: 'range', min: 0.25, max: 4, step: 0.25 } }
  }
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Meta<Args>>

export const Room: Story = {}

export const LongNames: Story = {
  args: {
    person: 'A collaborator with a very long display name',
    agent: 'An agent callsign far longer than any we hand out'
  }
}

export const ZoomedIn: Story = {
  args: { zoom: 2 }
}
