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

import { settingsErrorMessage } from '@/app/settings/credentials/errors'
import type { SettingsSaveResult } from '@/app/settings/save-result'

export function useMCPConnectionSettings(
  draft: Ref<MCPConnectionDraft>,
  tokenDraft: Ref<string>,
  automation: Readonly<Ref<{ bearerTokenRequired: string }>>,
  services = connectionServices
) {
  const tokenStatus = ref<CredentialStatus>('missing')
  const credentialCleared = ref(false)
  const error = ref('')
  const saveResult = ref<SettingsSaveResult | null>(null)
  const pending = ref(0)
  const busy = computed(() => pending.value > 0)

  let version = 0
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
    version++
    tokenDraft.value = ''
  })

  const savedConnection = computed(() =>
    mcpConnectionSettings.value.connections.find((connection) => connection.id === draft.value.id)
  )

  function current(request: number): boolean {
    return !disposed && request === version
  }

  function startAdd(): void {
    version++
    saveResult.value = null
    draft.value = createMCPConnectionDraft()
    credentialCleared.value = false
    tokenDraft.value = ''
    tokenStatus.value = 'missing'
    error.value = ''
  }

  async function startEdit(id: string): Promise<boolean> {
    const connection = mcpConnectionSettings.value.connections.find((item) => item.id === id)
    if (!connection) return false

    const request = ++version
    pending.value++
    saveResult.value = null
    draft.value = createMCPConnectionDraft(connection)
    credentialCleared.value = false
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

      error.value = settingsErrorMessage(cause)
      return true
    } finally {
      pending.value--
    }
  }

  async function save(): Promise<SettingsSaveResult> {
    const progress = { persisted: false }
    saveResult.value = null
    const request = ++version
    pending.value++
    const id: MCPConnectionID = draft.value.id ?? `mcp-${crypto.randomUUID()}`
    draft.value.id = id
    const target = { ...draft.value, id }
    const token = tokenDraft.value
    const clearToken = credentialCleared.value
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
        progress.persisted = true
        if (target.authenticationType === 'none' || (clearToken && !token.trim())) {
          await services.setCredential(connection.id, '')
        } else if (token.trim()) await services.setCredential(connection.id, token)
        else if (target.enabled && (await services.status(connection.id)) !== 'configured') {
          throw new Error(automation.value.bearerTokenRequired)
        }

        services.save({ ...target, id: connection.id })
      })
      if (!current(request)) return 'partial'

      if (tokenDraft.value === token) tokenDraft.value = ''
      saveResult.value = 'saved'
      return 'saved'
    } catch (cause) {
      const result = progress.persisted ? 'partial' : 'failed'
      if (current(request)) {
        error.value = settingsErrorMessage(cause)
        saveResult.value = result
      }
      return result
    } finally {
      pending.value--
    }
  }

  function clearCredential(): void {
    if (busy.value) return
    credentialCleared.value = true
    draft.value.enabled = false
    tokenDraft.value = ''
    tokenStatus.value = 'missing'
    error.value = ''
  }

  async function remove(): Promise<boolean> {
    saveResult.value = null
    const id = draft.value.id
    if (!id) return false

    const request = ++version
    pending.value++
    error.value = ''

    try {
      await enqueueMCPConnectionMutation(id, () => services.remove(id))
      return current(request)
    } catch (cause) {
      if (current(request)) error.value = settingsErrorMessage(cause)
      return false
    } finally {
      pending.value--
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
    busy,
    cancel: startAdd,
    tokenStatus,
    credentialCleared,
    error,
    saveResult,
    savedConnection,
    startAdd,
    startEdit,
    save,
    clearCredential,
    remove
  }
}
