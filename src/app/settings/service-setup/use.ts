import { computed, onMounted, ref, watch } from 'vue'

import { isConfigured as designModelConfigured } from '@/app/ai/chat/storage'
import { modelConnectionCredentialStatus, modelCredentialRevision } from '@/app/ai/models/runtime'
import { isUnconfiguredModelSettings } from '@/app/ai/models/settings/onboarding/apply'
import { aiModelSettings, isACPModelProfile, resolveAIModelRole } from '@/app/ai/models/store'
import { localMCPAvailable, mcpRuntime } from '@/app/automation/mcp/runtime'
import { webmcpMode } from '@/app/automation/webmcp/preferences'
import { webmcpRuntime } from '@/app/automation/webmcp/runtime'
import { vectorizeCredentialStatus, vectorizeProviderID } from '@/app/editor/vectorize'
import { enabledMCPConnections } from '@/app/integrations/mcp/store'
import { activeStorageProviderID } from '@/app/integrations/storage'
import { isStorageConfigured } from '@/app/integrations/storage/runtime'
import { browserCredentialsRemembered } from '@/app/settings/credentials/app'
import { pexelsKeyStatus, unsplashKeyStatus } from '@/app/settings/credentials/media'
import { settingsDialogOpen, type SettingsSection } from '@/app/settings/dialog'
import { IS_TAURI } from '@/constants'

export type ServiceSetupGroupID = 'ai' | 'storage' | 'media' | 'mcp' | 'browser'

export type ServiceSetupItemID =
  | 'design-model'
  | 'vision-model'
  | 'coding-agents'
  | 'pi-agent'
  | 'cloud-storage'
  | 'pexels'
  | 'unsplash'
  | 'vectorize'
  | 'local-mcp'
  | 'mcp-connections'
  | 'webmcp'
  | 'remember-keys'

/** `local-only` is cloud storage left unset: designs then live only where they are saved. */
export type ServiceSetupStatus = 'done' | 'todo' | 'local-only'

export interface ServiceSetupItem {
  id: ServiceSetupItemID
  group: ServiceSetupGroupID
  section: SettingsSection
  status: ServiceSetupStatus
}

export interface ServiceSetupGroup {
  id: ServiceSetupGroupID
  /** Where the group's services are set up: the section of its first service. */
  section: SettingsSection
  items: ServiceSetupItem[]
  done: number
  total: number
}

const GROUP_ORDER: ServiceSetupGroupID[] = ['ai', 'storage', 'media', 'mcp', 'browser']

function status(done: boolean): ServiceSetupStatus {
  return done ? 'done' : 'todo'
}

/**
 * What the app can connect to, and whether each service is set up. Review and Fast tasks are
 * left out: they can be assigned, but nothing uses them yet.
 */
export function useServiceSetup() {
  const visionConfigured = ref(false)
  const storageConfigured = ref(false)
  const vectorizeConfigured = ref(false)

  async function refresh(): Promise<void> {
    const vision = resolveAIModelRole('vision')
    const [visionStatus, storage, vectorize] = await Promise.all([
      // Like the others, a status that cannot be read counts as not set up.
      vision
        ? modelConnectionCredentialStatus(vision.connection.id).catch(() => 'missing' as const)
        : 'missing',
      isStorageConfigured(activeStorageProviderID.value).catch(() => false),
      vectorizeCredentialStatus(vectorizeProviderID.value).catch(() => 'missing')
    ])
    visionConfigured.value = visionStatus === 'configured'
    storageConfigured.value = storage
    vectorizeConfigured.value = vectorize === 'configured'
  }

  onMounted(() => void refresh())
  // Settings is where each service is set up, so its closing is when statuses change.
  watch(
    [
      settingsDialogOpen,
      aiModelSettings,
      modelCredentialRevision,
      activeStorageProviderID,
      vectorizeProviderID
    ],
    () => void refresh(),
    { deep: true }
  )

  const items = computed<ServiceSetupItem[]>(() => {
    const profiles = aiModelSettings.value.models
    const connections = aiModelSettings.value.connections
    const usesPi = profiles.some(
      (profile) =>
        connections.find((connection) => connection.id === profile.connectionId)?.providerID ===
        'harness:pi'
    )
    const list: (ServiceSetupItem | false)[] = [
      {
        id: 'design-model',
        group: 'ai',
        section: 'ai',
        status: status(
          designModelConfigured.value && !isUnconfiguredModelSettings(aiModelSettings.value)
        )
      },
      { id: 'vision-model', group: 'ai', section: 'ai', status: status(visionConfigured.value) },
      IS_TAURI && {
        id: 'coding-agents',
        group: 'ai',
        section: 'ai',
        status: status(profiles.some((profile) => isACPModelProfile(profile)))
      },
      IS_TAURI && { id: 'pi-agent', group: 'ai', section: 'ai', status: status(usesPi) },
      {
        id: 'cloud-storage',
        group: 'storage',
        section: 'storage',
        status: storageConfigured.value ? 'done' : 'local-only'
      },
      {
        id: 'pexels',
        group: 'media',
        section: 'media',
        status: status(pexelsKeyStatus.value === 'configured')
      },
      {
        id: 'unsplash',
        group: 'media',
        section: 'media',
        status: status(unsplashKeyStatus.value === 'configured')
      },
      {
        id: 'vectorize',
        group: 'media',
        section: 'media',
        status: status(vectorizeConfigured.value)
      },
      localMCPAvailable() && {
        id: 'local-mcp',
        group: 'mcp',
        section: 'mcp',
        status: status(mcpRuntime.status === 'running')
      },
      {
        id: 'mcp-connections',
        group: 'mcp',
        section: 'mcp',
        status: status(enabledMCPConnections.value.length > 0)
      },
      !IS_TAURI && {
        id: 'webmcp',
        group: 'mcp',
        section: 'mcp',
        status: status(webmcpMode.value !== 'off' && webmcpRuntime.status === 'ready')
      },
      !IS_TAURI && {
        id: 'remember-keys',
        group: 'browser',
        section: 'general',
        status: status(browserCredentialsRemembered.value)
      }
    ]
    return list.filter((item): item is ServiceSetupItem => item !== false)
  })

  const groups = computed<ServiceSetupGroup[]>(() =>
    GROUP_ORDER.flatMap((id) => {
      const groupItems = items.value.filter((item) => item.group === id)
      const first = groupItems.at(0)
      if (!first) return []
      return [
        {
          id,
          section: first.section,
          items: groupItems,
          done: groupItems.filter((item) => item.status === 'done').length,
          total: groupItems.length
        }
      ]
    })
  )

  const totals = computed(() => ({
    done: items.value.filter((item) => item.status === 'done').length,
    total: items.value.length
  }))

  return { items, groups, totals, refresh }
}
