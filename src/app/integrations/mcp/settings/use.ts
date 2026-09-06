import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch, type Ref } from 'vue'

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

import { enqueueMCPConnectionMutation } from '../mutations'
import type { MCPConnectionID } from '../types'

const connectionServices = {
  status: mcpConnectionCredentialStatus,
  save: saveMCPConnectionDraft,
  setCredential: setMCPConnectionCredential,
  remove: removeMCPConnection
}

export function useMCPConnectionSettings(
  tokenDraft: Ref<string>,
  automation: Readonly<Ref<{ bearerTokenRequired: string }>>,
  services = connectionServices
) {
  const draft = ref<MCPConnectionDraft>(createMCPConnectionDraft())
  const tokenStatus = ref<CredentialStatus>('missing')
  const error = ref('')

  let version = 0
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
    version++
  })

  const savedConnection = computed(() =>
    mcpConnectionSettings.value.connections.find((connection) => connection.id === draft.value.id)
  )

  function current(request: number): boolean {
    return !disposed && request === version
  }

  function startAdd(): void {
    version++
    draft.value = createMCPConnectionDraft()
    tokenDraft.value = ''
    tokenStatus.value = 'missing'
    error.value = ''
  }

  async function startEdit(id: string): Promise<boolean> {
    const connection = mcpConnectionSettings.value.connections.find((item) => item.id === id)
    if (!connection) return false

    const request = ++version
    draft.value = createMCPConnectionDraft(connection)
    tokenDraft.value = ''
    tokenStatus.value = 'missing'
    error.value = ''

    try {
      const status = await services.status(connection.id)
      if (!current(request)) return false

      tokenStatus.value = status
      return true
    } catch (cause) {
      if (!current(request)) return false

      error.value = cause instanceof Error ? cause.message : String(cause)
      return true
    }
  }

  async function save(): Promise<boolean> {
    const request = ++version
    const id: MCPConnectionID = draft.value.id ?? `mcp-${crypto.randomUUID()}`
    draft.value.id = id
    const target = { ...draft.value, id }
    const token = tokenDraft.value
    error.value = ''

    try {
      if (
        target.enabled &&
        target.authenticationType === 'bearer' &&
        !token.trim() &&
        tokenStatus.value !== 'configured'
      ) {
        throw new Error(automation.value.bearerTokenRequired)
      }

      await enqueueMCPConnectionMutation(id, async () => {
        const connection = services.save({ ...target, enabled: false })
        if (target.authenticationType === 'none') await services.setCredential(connection.id, '')
        else if (token.trim()) await services.setCredential(connection.id, token)
        else if (target.enabled && (await services.status(connection.id)) !== 'configured') {
          throw new Error(automation.value.bearerTokenRequired)
        }

        services.save({ ...target, id: connection.id })
      })
      if (!current(request)) return false

      if (tokenDraft.value === token) tokenDraft.value = ''
      return true
    } catch (cause) {
      if (current(request)) error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
  }

  async function clearCredential(): Promise<void> {
    const id = draft.value.id
    if (!id) return

    const request = ++version
    const token = tokenDraft.value
    error.value = ''

    try {
      await enqueueMCPConnectionMutation(id, async () => {
        const connection = mcpConnectionSettings.value.connections.find((item) => item.id === id)
        if (!connection) throw new Error('Connection no longer exists')

        services.save({ ...createMCPConnectionDraft(connection), enabled: false })
        await services.setCredential(id, '')
      })
      if (!current(request)) return

      draft.value.enabled = false
      if (tokenDraft.value === token) tokenDraft.value = ''
      tokenStatus.value = 'missing'
    } catch (cause) {
      if (current(request)) error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  async function remove(): Promise<boolean> {
    const id = draft.value.id
    if (!id) return false

    const request = ++version
    error.value = ''

    try {
      await enqueueMCPConnectionMutation(id, () => services.remove(id))
      return current(request)
    } catch (cause) {
      if (current(request)) error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
  }

  watch(
    () => draft.value.authenticationType,
    (type) => {
      if (type === 'none') tokenDraft.value = ''
    }
  )

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
