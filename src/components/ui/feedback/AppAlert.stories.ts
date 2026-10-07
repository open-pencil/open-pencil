import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { AlertProps } from './alert'
import AppAlert from './AppAlert.vue'

const meta = {
  title: 'Design System/Feedback/Alert',
  component: AppAlert,
  args: {
    heading: 'Connection information',
    description: 'This message stays visible while it is relevant.',
    tone: 'info'
  },
  render: (args) => ({
    components: { AppAlert },
    setup: () => ({ args }),
    template: '<div class="w-96 max-w-full"><AppAlert v-bind="args" /></div>'
  })
} satisfies Meta<AlertProps>

export default meta
type Story = StoryObj<typeof meta>
export const Info: Story = {}
export const Success: Story = { args: { tone: 'success', heading: 'Connection verified' } }
export const Warning: Story = {
  args: {
    tone: 'warning',
    heading: 'Some changes are already saved',
    description: 'Review the settings and retry the remaining changes.'
  }
}
export const Error: Story = {
  args: {
    tone: 'error',
    heading: 'Could not save changes',
    description: 'Check the settings and try again.'
  }
}
