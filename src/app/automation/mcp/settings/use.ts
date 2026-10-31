import { open } from '@tauri-apps/plugin-dialog'
import { onMounted } from 'vue'

import { mcpRootDirectory } from '@/app/automation/mcp/preferences'
import { refreshMCPRuntime, restartMCPRuntime } from '@/app/automation/mcp/runtime'
import { isTauri } from '@/app/tauri/env'

export function useMCPSettings() {
  onMounted(() => {
    void refreshMCPRuntime()
  })

  function restart(): void {
    void restartMCPRuntime()
  }

  async function chooseRootDirectory(): Promise<void> {
    if (!isTauri()) return

    const directory = await open({ directory: true, multiple: false })
    if (typeof directory === 'string') mcpRootDirectory.value = directory
  }

  return { restart, chooseRootDirectory }
}
