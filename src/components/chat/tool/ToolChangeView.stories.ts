import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { toUint8Array } from 'js-base64'

import type { ToolChange } from '@/app/ai/tools/changes/types'

import ToolChangeView from './ToolChangeView.vue'

const BEFORE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAGAAAAA4CAYAAAACRf2iAAAAgklEQVR42u3bsQkAIAxE0ewquH8KCysdQUgThFf8Be7VF7n2UV9hBAAABACAAAAQAAACAODVmPltAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8BFz0hMAAAIAQAAACAAAVburId+HNheO5AAAAABJRU5ErkJggg=='
const AFTER_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAGAAAAA4CAYAAAACRf2iAAAAgUlEQVR42u3bMREAIAwEwUjAMrIii4KCCmRkwmxxBn7rj7XPVV1hBAAABACAAAAQAAACAKC6kbNtAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkJMeAAEAIAAABACAAPzbA4wnD7kKs8uLAAAAAElFTkSuQmCC'
const HIGHLIGHT_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAGAAAAA4CAYAAAACRf2iAAAAaElEQVR42u3RAQkAAAjAMDvZyf4NtIABRHZ4gkVIkiRJkiTdrrPa+wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJAkSZIk6W8DhJ0lO3L6NnEAAAAASUVORK5CYII='

function png(base64: string): Blob {
  return new Blob([new Uint8Array(toUint8Array(base64))], { type: 'image/png' })
}

const change: ToolChange = {
  toolCallId: 'move-card',
  pageId: '0:1',
  nodeIds: ['12:4'],
  jsx: {
    before:
      '<Frame name="Card" x={12} w={48} h={36} bg="#6366F1">\n  <Text>Starter</Text>\n</Frame>',
    after: '<Frame name="Card" x={36} w={48} h={36} bg="#10B981">\n  <Text>Starter</Text>\n</Frame>'
  },
  images: {
    before: png(BEFORE_PNG),
    after: png(AFTER_PNG),
    highlight: png(HIGHLIGHT_PNG),
    width: 96,
    height: 56,
    changedRatio: 0.42
  }
}

interface Args {
  change: ToolChange
}

const meta = {
  title: 'Chat/Tool change',
  component: ToolChangeView,
  args: { change },
  render: (args) => ({
    components: { ToolChangeView },
    setup: () => ({ args }),
    template: '<div class="w-80"><ToolChangeView v-bind="args" /></div>'
  })
} satisfies Meta<Args>
export default meta
type Story = StoryObj<Omit<typeof meta, 'component'>>

export const Visual: Story = {}
export const StructureOnly: Story = { args: { change: { ...change, images: undefined } } }
