import { computed, onMounted, ref, watch, type Ref } from 'vue'

import {
  createMCPConnectionDraft,
  mcpConnectionCredentialStatus,
  mcpConnectionSettings,
  removeMCPConnection,
  saveMCPConnectionDraft,
  setMCPConnectionCredential,
  type MCPConnectionDraft
} from '@/app/integrations/mcp'
import type { CredentialStatus } from '@/app/settings/credentials/types'
export function useMCPConnectionSettings(
  tokenDraft: Ref<string>,
  automation: Readonly<Ref<{ bearerTokenRequired: string }>>
) {
  const draft = ref<MCPConnectionDraft>(createMCPConnectionDraft())
  const tokenStatus = ref<CredentialStatus>('missing')
  const error = ref('')
  const savedConnection = computed(() =>
    draft.value.id
      ? mcpConnectionSettings.value.connections.find(
          (connection) => connection.id === draft.value.id
        )
      : undefined
  )
  function startAdd(): void {
    draft.value = createMCPConnectionDraft()
    tokenDraft.value = ''
    tokenStatus.value = 'missing'
    error.value = ''
  }
  async function startEdit(id: string): Promise<boolean> {
    const connection = mcpConnectionSettings.value.connections.find((item) => item.id === id)
    if (!connection) return false
    draft.value = createMCPConnectionDraft(connection)
    tokenDraft.value = ''
    tokenStatus.value = await mcpConnectionCredentialStatus(connection.id)
    error.value = ''
    return true
  }
  async function save(): Promise<boolean> {
    error.value = ''
    try {
      if (
        draft.value.enabled &&
        draft.value.authenticationType === 'bearer' &&
        !tokenDraft.value.trim() &&
        tokenStatus.value !== 'configured'
      ) {
        throw new Error(automation.value.bearerTokenRequired)
      }
      const connection = saveMCPConnectionDraft(draft.value)
      if (draft.value.authenticationType === 'none') {
        await setMCPConnectionCredential(connection.id, '')
      } else if (tokenDraft.value.trim()) {
        await setMCPConnectionCredential(connection.id, tokenDraft.value)
      }
      tokenDraft.value = ''
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
  }
  async function clearCredential(): Promise<void> {
    if (!draft.value.id) return
    error.value = ''
    try {
      await setMCPConnectionCredential(draft.value.id, '')
      draft.value.enabled = false
      saveMCPConnectionDraft(draft.value)
      tokenDraft.value = ''
      tokenStatus.value = 'missing'
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }
  async function remove(): Promise<boolean> {
    if (!draft.value.id) return false
    error.value = ''
    try {
      await removeMCPConnection(draft.value.id)
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
  }
  watch(
    () => draft.value.authenticationType,
    (type) => {
      if (type === 'none') tokenDraft.value = ''
    }
  )
  onMounted(() => {
    tokenStatus.value = savedConnection.value ? 'configured' : 'missing'
  })

  return {
    draft,
    tokenStatus,
    error,
    savedConnection,
    startAdd,
    startEdit,
    save,
    clearCredential,
    remove
  }
}
