import { Child, type Command, type IOPayload } from '@tauri-apps/plugin-shell'
import { StorageSerializers, useSessionStorage } from '@vueuse/core'
import * as v from 'valibot'
import { ref, type Ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

const pidsSchema = v.array(v.pipe(v.number(), v.integer(), v.minValue(0)))

/**
 * Agent processes a page started, kept in storage that outlives the page. Plugin-shell stops its
 * children only when the app exits, so a reload of the webview leaves them running, still holding
 * the agent sessions the reloaded page continues. Each page stops what the page before it left
 * before it starts agents of its own.
 */
export function createAgentChildren(stored: Ref<unknown>) {
  let leftovers: Promise<void> | null = null

  function pids(): number[] {
    const parsed = v.safeParse(pidsSchema, stored.value)
    return parsed.success ? parsed.output : []
  }

  /**
   * Stops the agent processes the previous page left running, once per page. Plugin-shell kills
   * only children it still runs, so a pid that has exited since is ignored.
   */
  function stopLeftovers(): Promise<void> {
    return (leftovers ??= (async () => {
      const left = pids()
      stored.value = null
      await Promise.all(left.map((pid) => new Child(pid).kill().catch(() => undefined)))
    })())
  }

  /** Starts an agent process, which the next page stops if this page leaves it running. */
  async function spawn<O extends IOPayload>(command: Command<O>): Promise<Child> {
    await stopLeftovers()
    let pid: number | null = null
    let closed = false
    command.on('close', () => {
      closed = true
      if (pid !== null) stored.value = pids().filter((other) => other !== pid)
    })
    const child = await command.spawn()
    pid = child.pid
    if (!closed) stored.value = [...pids(), pid]
    return child
  }

  return { stopLeftovers, spawn }
}

// The window's session storage outlives a reload but not the app, whose exit stops every child.
const children = createAgentChildren(
  IS_BROWSER
    ? useSessionStorage<unknown>('open-pencil:agent-children', null, {
        serializer: StorageSerializers.object,
        writeDefaults: false
      })
    : ref<unknown>(null)
)

export const stopLeftoverAgentChildren = children.stopLeftovers
export const spawnAgentChild = children.spawn
