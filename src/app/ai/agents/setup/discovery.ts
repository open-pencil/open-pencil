import { computed, ref, shallowRef } from 'vue'

import {
  ACP_AGENTS,
  IS_TAURI,
  type ACPAgentDef,
  type ACPAgentID
} from '@open-pencil/core/constants'

import {
  HARNESS_EXECUTABLE,
  HARNESS_INSTALL_TARGET,
  HARNESS_PACKAGE
} from '@/app/ai/agents/pi/companion'
import { MCP_EXECUTABLE, MCP_INSTALL_TARGET, MCP_PACKAGE_NAME } from '@/app/automation/mcp/failure'
import { restartMCPRuntime } from '@/app/automation/mcp/runtime'
import { detectUserAgent } from '@/app/tauri/command'

import {
  companionPackageManager,
  globalInstallCommand,
  isOutdatedCompanion,
  type PackageManager
} from './companions'
import {
  installAgentAdapter,
  installCanvasBridge,
  installHarnessCompanion,
  lookupAgents,
  type AgentLookup
} from './native'

export type DetectedAgent = {
  definition: ACPAgentDef
  cliPath: string | null
  adapterPath: string | null
  status: 'available' | 'needs-adapter' | 'not-installed'
}

export function detectedAgents(lookup: AgentLookup): DetectedAgent[] {
  return ACP_AGENTS.map((definition) => {
    const cliPath = lookup.executables[definition.cliCommand ?? definition.command] ?? null
    const adapterPath = lookup.executables[definition.command] ?? null
    // An adapter package carries its agent, so it installs whether or not the CLI is there.
    const unavailableStatus = definition.adapterPackage ? 'needs-adapter' : 'not-installed'
    return {
      definition,
      cliPath,
      adapterPath,
      status: adapterPath ? 'available' : unavailableStatus
    }
  })
}

/** What went wrong in the last lookup or installation. */
export type DiscoveryError =
  | 'lookup'
  | 'install'
  | 'npm'
  | 'canvas-install'
  | 'canvas-start'
  | 'harness-install'
  /** npm's global folder needs administrator rights, which the app never asks for. */
  | 'npm-admin'

export function createAgentDiscovery(options: {
  enabled: boolean
  lookup: () => Promise<AgentLookup>
  install: (agent: ACPAgentDef, searchPath: string) => Promise<void>
  installBridge?: (searchPath: string, manager: PackageManager) => Promise<void>
  restartBridge?: () => Promise<void>
  installHarness?: (searchPath: string, manager: PackageManager) => Promise<void>
}) {
  const snapshot = shallowRef<AgentLookup | null>(null)
  const scanning = ref(false)
  const installing = ref<ACPAgentID | 'canvas' | 'harness' | null>(null)
  const error = ref<DiscoveryError | null>(null)
  let pending: Promise<void> | null = null
  const agents = computed(() => (snapshot.value ? detectedAgents(snapshot.value) : []))
  const availableAgents = computed(() =>
    agents.value.filter((agent) => agent.status === 'available')
  )
  const npmAvailable = computed(() => Boolean(snapshot.value?.executables.npm))
  /** A lookup has finished, so a later rescan can keep showing its results. */
  const checked = computed(() => snapshot.value !== null)
  // Checks read through functions so they see the snapshot of a rescan that just finished.
  function hasBridge(): boolean {
    return Boolean(snapshot.value?.executables[MCP_EXECUTABLE])
  }
  /** An installed MCP server whose version does not match the app. */
  function bridgeOutdated(): boolean {
    return hasBridge() && isOutdatedCompanion(snapshot.value?.versions[MCP_PACKAGE_NAME])
  }
  function canInstallWith(manager: PackageManager): boolean {
    return Boolean(snapshot.value?.executables[manager])
  }
  /** npm installs global packages where this user cannot write, so only an administrator can. */
  function npmNeedsAdmin(): boolean {
    return snapshot.value?.npmGlobalWritable === false
  }
  /**
   * The package manager that installed a companion updates it, so the new copy replaces the
   * old one on PATH; another manager would install beside it and leave the old copy first.
   * A new install uses npm, or Bun when npm would need administrator rights.
   */
  function managerFor(executable: string): PackageManager {
    const path = snapshot.value?.executables[executable]
    if (path) return companionPackageManager(path)
    return npmNeedsAdmin() && canInstallWith('bun') ? 'bun' : 'npm'
  }
  /** Installing this companion would need administrator rights. */
  function needsAdmin(executable: string): boolean {
    return managerFor(executable) === 'npm' && npmNeedsAdmin()
  }
  function installCommand(target: string, executable: string): string {
    // Run by hand in the person's own terminal, which may find a manager the app cannot.
    return globalInstallCommand(target, managerFor(executable), {
      admin: needsAdmin(executable),
      windows: detectUserAgent().includes('Windows')
    })
  }
  function hasHarness(): boolean {
    return Boolean(snapshot.value?.executables[HARNESS_EXECUTABLE])
  }
  function harnessOutdated(): boolean {
    return hasHarness() && isOutdatedCompanion(snapshot.value?.versions[HARNESS_PACKAGE])
  }
  const canvasBridgeAvailable = computed(hasBridge)
  const canvasBridgeOutdated = computed(bridgeOutdated)
  /** The Harness companion that runs Pi. */
  const harnessAvailable = computed(hasHarness)
  const harnessOutdatedVersion = computed(harnessOutdated)
  /** Commands to install or update a companion by hand, for the package manager that has it. */
  const canvasBridgeCommand = computed(() => installCommand(MCP_INSTALL_TARGET, MCP_EXECUTABLE))
  const harnessCommand = computed(() => installCommand(HARNESS_INSTALL_TARGET, HARNESS_EXECUTABLE))
  const canvasBridgeNeedsAdmin = computed(() => needsAdmin(MCP_EXECUTABLE))
  const harnessNeedsAdmin = computed(() => needsAdmin(HARNESS_EXECUTABLE))
  /** One click can install or update it, with the package manager that would run. */
  function installable(executable: string): boolean {
    return canInstallWith(managerFor(executable)) && !needsAdmin(executable)
  }
  const canvasBridgeInstallable = computed(() => installable(MCP_EXECUTABLE))
  const harnessInstallable = computed(() => installable(HARNESS_EXECUTABLE))
  /** Agent adapters always come from npm. */
  const adapterNeedsAdmin = computed(npmNeedsAdmin)

  function refresh(force = false): Promise<void> {
    if (!options.enabled) return Promise.resolve()
    if (pending) return force ? pending.then(() => refresh()) : pending
    scanning.value = true
    error.value = null
    pending = options
      .lookup()
      .then((result) => {
        snapshot.value = result
        return undefined
      })
      .catch(() => {
        error.value = 'lookup'
      })
      .finally(() => {
        scanning.value = false
        pending = null
      })
    return pending
  }

  async function install(id: ACPAgentID): Promise<void> {
    if (!options.enabled || installing.value) return
    const agent = agents.value.find((candidate) => candidate.definition.id === id)
    if (!agent?.definition.adapterPackage || agent.status !== 'needs-adapter') return
    if (!snapshot.value || !npmAvailable.value) {
      error.value = 'npm'
      return
    }
    if (npmNeedsAdmin()) {
      error.value = 'npm-admin'
      return
    }
    installing.value = id
    error.value = null
    try {
      await options.install(agent.definition, snapshot.value.searchPath)
      await refresh(true)
      if (
        agents.value.find((candidate) => candidate.definition.id === id)?.status !== 'available'
      ) {
        error.value = 'install'
      }
    } catch {
      error.value = 'install'
    } finally {
      installing.value = null
    }
  }

  async function setupCanvasBridge(): Promise<void> {
    if (!options.enabled || installing.value || !snapshot.value) return
    let installed = hasBridge() && !bridgeOutdated()
    const manager = managerFor(MCP_EXECUTABLE)
    if (!installed && !canInstallWith(manager)) {
      // A Bun copy the app cannot update leaves only the command run by hand.
      error.value = manager === 'npm' ? 'npm' : 'canvas-install'
      return
    }
    if (!installed && needsAdmin(MCP_EXECUTABLE)) {
      error.value = 'npm-admin'
      return
    }
    installing.value = 'canvas'
    error.value = null
    try {
      if (!installed) {
        if (!options.installBridge) throw new Error('Canvas bridge setup is unavailable.')
        await options.installBridge(snapshot.value.searchPath, manager)
        await refresh(true)
        if (!hasBridge() || bridgeOutdated())
          throw new Error('A matching MCP server was not found.')
        installed = true
      }
      await options.restartBridge?.()
    } catch {
      error.value = installed ? 'canvas-start' : 'canvas-install'
    } finally {
      installing.value = null
    }
  }

  async function setupHarness(): Promise<void> {
    if (!options.enabled || installing.value || !snapshot.value) return
    if (hasHarness() && !harnessOutdated()) return
    const manager = managerFor(HARNESS_EXECUTABLE)
    if (!canInstallWith(manager)) {
      error.value = manager === 'npm' ? 'npm' : 'harness-install'
      return
    }
    if (needsAdmin(HARNESS_EXECUTABLE)) {
      error.value = 'npm-admin'
      return
    }
    installing.value = 'harness'
    error.value = null
    try {
      if (!options.installHarness) throw new Error('Harness companion setup is unavailable.')
      await options.installHarness(snapshot.value.searchPath, manager)
      await refresh(true)
      if (!hasHarness() || harnessOutdated()) error.value = 'harness-install'
    } catch {
      error.value = 'harness-install'
    } finally {
      installing.value = null
    }
  }

  return {
    supported: options.enabled,
    agents,
    availableAgents,
    scanning,
    checked,
    installing,
    error,
    npmAvailable,
    canvasBridgeAvailable,
    canvasBridgeOutdated,
    canvasBridgeCommand,
    canvasBridgeNeedsAdmin,
    canvasBridgeInstallable,
    harnessAvailable,
    harnessOutdated: harnessOutdatedVersion,
    harnessCommand,
    harnessNeedsAdmin,
    harnessInstallable,
    adapterNeedsAdmin,
    setupCanvasBridge,
    setupHarness,
    refresh,
    install
  }
}

export const agentDiscovery = createAgentDiscovery({
  enabled: IS_TAURI,
  lookup: lookupAgents,
  install: installAgentAdapter,
  installBridge: installCanvasBridge,
  installHarness: installHarnessCompanion,
  async restartBridge() {
    const result = await restartMCPRuntime()
    if (!result.ok) throw result.error
  }
})
