import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

const MCP_CONNECTION_SETTINGS_KEY = 'open-pencil:mcp-connections'

const connectionSettings = !IS_BROWSER
  ? ref<unknown>(null)
  : useLocalStorage<unknown>(MCP_CONNECTION_SETTINGS_KEY, null, {
      serializer: StorageSerializers.object,
      writeDefaults: false
    })

export function readMCPConnectionSettingsStorage(): unknown {
  return connectionSettings.value
}

export function writeMCPConnectionSettingsStorage(value: unknown): void {
  connectionSettings.value = value
}
