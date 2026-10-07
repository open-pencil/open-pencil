import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import { getWebMCPTools, type WebMCPMode } from '@/app/automation/webmcp/policy'
import type { WebMCPRuntimeState } from '@/app/automation/webmcp/service'

import WebMCPSettingsPanel from './WebMCPSettingsPanel.vue'

type Args = { modelValue: WebMCPMode; state: WebMCPRuntimeState }
const meta = {
  title: 'App/Settings/MCP/WebMCP',
  args: { modelValue: 'off', state: { status: 'off', toolCount: 0, error: null } },
  render: (args) => ({
    components: { WebMCPSettingsPanel },
    setup: () => ({ args, mode: ref(args.modelValue) }),
    template:
      '<div class="max-w-lg bg-panel p-4"><WebMCPSettingsPanel v-model="mode" :state="args.state" /></div>'
  })
} satisfies Meta<Args>
export default meta
type Story = StoryObj<typeof meta>
export const Off: Story = {}
export const Inspect: Story = {
  args: {
    modelValue: 'inspect',
    state: { status: 'ready', toolCount: getWebMCPTools('inspect').length, error: null }
  }
}
export const Edit: Story = {
  args: {
    modelValue: 'edit',
    state: { status: 'ready', toolCount: getWebMCPTools('edit').length, error: null }
  }
}
export const Unsupported: Story = {
  args: { state: { status: 'unsupported', toolCount: 0, error: null } }
}
export const Starting: Story = {
  args: { modelValue: 'inspect', state: { status: 'starting', toolCount: 0, error: null } }
}
export const Rejected: Story = {
  args: {
    modelValue: 'inspect',
    state: { status: 'error', toolCount: 0, error: 'The browser denied tool registration.' }
  }
}
