import { computed } from 'vue'

import { useSettingsMessages } from '@open-pencil/vue'

import type { ServiceSetupGroupID, ServiceSetupItemID } from '@/app/settings/service-setup/use'

/** The names Service setup shows for its groups and services, in the current language. */
export function useServiceSetupLabels() {
  const settings = useSettingsMessages()

  const groupLabels = computed<Record<ServiceSetupGroupID, string>>(() => ({
    ai: settings.value.setupGroupAI,
    storage: settings.value.setupGroupStorage,
    media: settings.value.setupGroupMedia,
    mcp: settings.value.setupGroupMCP,
    browser: settings.value.setupGroupBrowser
  }))

  const itemLabels = computed<Record<ServiceSetupItemID, string>>(() => ({
    'design-model': settings.value.setupDesignModel,
    'vision-model': settings.value.setupVisionModel,
    'coding-agents': settings.value.setupCodingAgents,
    'pi-agent': settings.value.setupPiAgent,
    'cloud-storage': settings.value.setupCloudStorage,
    pexels: settings.value.setupPexels,
    unsplash: settings.value.setupUnsplash,
    vectorize: settings.value.setupVectorize,
    'local-mcp': settings.value.setupLocalMCP,
    'mcp-connections': settings.value.setupMCPConnections,
    webmcp: settings.value.setupWebMCP,
    'remember-keys': settings.value.setupRememberKeys
  }))

  return { groupLabels, itemLabels }
}
