import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppCopyField from './AppCopyField.vue'

interface Args {
  value: string
  copyLabel: string
  copiedLabel: string
  look?: 'command' | 'plain'
}

const meta = {
  title: 'Design System/Inputs/Copy Field',
  args: {
    value: 'npm i -g @open-pencil/mcp@0.15.1',
    copyLabel: 'Copy',
    copiedLabel: 'Copied'
  },
  render: (args) => ({
    components: { AppCopyField },
    setup: () => ({ args }),
    template: '<div class="w-96 bg-panel p-6"><AppCopyField v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Command: Story = {}
export const Plain: Story = {
  args: { value: 'http://127.0.0.1:7600/mcp', look: 'plain' }
}
