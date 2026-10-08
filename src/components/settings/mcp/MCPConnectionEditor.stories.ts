import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { MCPConnectionDraft } from '@/app/integrations/mcp'
import type { CredentialStatus } from '@/app/settings/credentials/types'

import MCPConnectionEditor from './MCPConnectionEditor.vue'

type Args = {
  draft: MCPConnectionDraft
  tokenStatus: CredentialStatus
  busy: boolean
  error: string
}
const emptyDraft: MCPConnectionDraft = {
  id: null,
  name: '',
  url: '',
  enabled: false,
  authenticationType: 'none'
}
const savedDraft: MCPConnectionDraft = {
  id: 'mcp-story',
  name: 'Design library',
  url: 'https://example.com/mcp',
  enabled: true,
  authenticationType: 'bearer'
}
const meta = {
  title: 'App/Settings/MCP/Connection Editor',
  args: { draft: emptyDraft, tokenStatus: 'missing', busy: false, error: '' },
  render: (args) => ({
    components: { MCPConnectionEditor },
    setup: () => ({ args, draft: ref({ ...args.draft }), token: ref('') }),
    template:
      '<div class="max-w-lg bg-panel p-4"><MCPConnectionEditor v-model:draft="draft" v-model:token="token" :token-status="args.tokenStatus" :busy="args.busy" :error="args.error" /></div>'
  })
} satisfies Meta<Args>
export default meta
type Story = StoryObj<typeof meta>
export const Create: Story = {}
export const Edit: Story = { args: { draft: savedDraft, tokenStatus: 'configured' } }
export const MissingCredential: Story = { args: { draft: savedDraft } }
export const Saving: Story = { args: { draft: savedDraft, tokenStatus: 'configured', busy: true } }
export const CredentialFailure: Story = {
  args: { draft: savedDraft, error: 'The credential store is locked. Unlock it and try again.' }
}
