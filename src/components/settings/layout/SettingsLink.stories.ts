import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SettingsLink from './SettingsLink.vue'

interface Args {
  href: string
  label: string
}

const meta = {
  title: 'App/Settings/Layout/Link',
  component: SettingsLink,
  args: {
    href: 'https://openpencil.dev/programmable/mcp-server#webmcp',
    label: 'WebMCP setup guide'
  },
  render: (args) => ({
    components: { SettingsLink },
    setup: () => ({ args }),
    template: '<SettingsLink :href="args.href">{{ args.label }}</SettingsLink>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Documentation: Story = {}
export const APIKey: Story = {
  args: { href: 'https://www.pexels.com/api/', label: 'Get API key' }
}
