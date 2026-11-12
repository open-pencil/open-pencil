import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  computed,
  ref,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef
} from 'vue'

import type { Project } from './schema'

/** How many lines of the application's output the screen keeps. */
const MAX_OUTPUT_LINES = 300
/**
 * A dev server names its address on the line that says it is ready. Only an address of this
 * machine is taken: a server started with `--host` prints its network address after the local
 * one, and a page that opens there is one the app cannot draw a picture of.
 */
const ADDRESS = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d{2,5}(?!\d)/
/** The colours and the cursor a terminal is given, which a dev server prints around its address. */
// eslint-disable-next-line no-control-regex -- Escape sequences are what it removes.
const TERMINAL_CODES = /\u001B\[[0-9;?]*[A-Za-z]/g

export type ProjectRunState = 'idle' | 'starting' | 'running' | 'stopped' | 'failed'

type OutputEvent = { id: string; line: string }
type ExitEvent = { id: string; code: number | null }

/** The native side's events, injected so the runner is testable without Tauri. */
export type ProjectRunnerEvents = {
  listenOutput: (listener: (event: OutputEvent) => void) => Promise<() => void>
  listenExit: (listener: (event: ExitEvent) => void) => Promise<() => void>
}

export type ProjectRunnerTransport = (
  command: string,
  args?: Record<string, unknown>
) => Promise<unknown>

export function nativeProjectRunnerEvents(): ProjectRunnerEvents {
  return {
    listenOutput: async (listener) =>
      listen<OutputEvent>('project-output', (event) => listener(event.payload)),
    listenExit: async (listener) =>
      listen<ExitEvent>('project-exit', (event) => listener(event.payload))
  }
}

/** The run of one project, kept outside the screen so leaving its tab does not lose it. */
type ProjectRun = {
  state: Ref<ProjectRunState>
  output: Ref<string[]>
  exitCode: Ref<number | null>
  failure: ShallowRef<string | null>
  detach: () => void
}

const runs = new Map<string, ProjectRun>()

function runOf(id: string): ProjectRun {
  const existing = runs.get(id)
  if (existing) return existing
  const run: ProjectRun = {
    state: ref('idle'),
    output: ref([]),
    exitCode: ref(null),
    failure: shallowRef(null),
    detach: () => undefined
  }
  runs.set(id, run)
  return run
}

/** The folder the application lives in: the repository root, or the one inside it. */
export function applicationFolder(project: Project): string {
  return project.appDirectory === ''
    ? project.repository
    : `${project.repository}/${project.appDirectory}`
}

/** Where the application answers: the address its command names, or the one it printed. */
export function applicationAddress(project: Project, output: readonly string[]): string {
  if (project.startUrl !== '') return project.startUrl
  for (let index = output.length - 1; index >= 0; index -= 1) {
    const found = ADDRESS.exec(output[index].replace(TERMINAL_CODES, ''))
    if (found) return found[0]
  }
  return ''
}

/**
 * Starting and stopping the application a project holds. The run lives outside the screen, so
 * switching tabs keeps it, and one project runs one application at a time.
 */
export function useProjectRunner(
  project: MaybeRefOrGetter<Project>,
  transport: ProjectRunnerTransport = invoke,
  events: ProjectRunnerEvents = nativeProjectRunnerEvents()
) {
  const run = runOf(toValue(project).id)

  /** Whether the application is running or on its way, which is one at a time. */
  const active = computed(() => run.state.value === 'starting' || run.state.value === 'running')

  async function attach(id: string): Promise<void> {
    run.detach()
    const stops: (() => void)[] = []
    // Bound before the listeners are, so a listener that fails to bind leaves nothing behind: an
    // exit that arrives meanwhile stops what was already bound instead of leaking it.
    run.detach = () => {
      for (const stop of stops.splice(0)) stop()
    }
    try {
      stops.push(
        await events.listenOutput((event) => {
          if (event.id !== id) return
          run.output.value = [...run.output.value, event.line].slice(-MAX_OUTPUT_LINES)
        })
      )
      stops.push(
        await events.listenExit((event) => {
          if (event.id !== id) return
          run.state.value = 'stopped'
          run.exitCode.value = event.code
          run.detach()
        })
      )
    } catch (error) {
      run.detach()
      throw error
    }
  }

  /**
   * Say a run that was starting is now running. A process that exited before its start command
   * answered has already moved the run to stopped, and its exit code is what the panel should
   * show, so a run that is no longer starting keeps the state it reached.
   */
  function markStarted(): void {
    if (run.state.value === 'starting') run.state.value = 'running'
  }

  async function start(): Promise<boolean> {
    const target = toValue(project)
    if (target.startCommand.trim() === '') return false
    // One application at a time: a second press must not clear the output of a run that is up.
    if (active.value) return false
    run.state.value = 'starting'
    run.failure.value = null
    run.exitCode.value = null
    run.output.value = []
    try {
      // The window's events are bound before the process starts, so its first line is kept.
      await attach(target.id)
      await transport('project_start', {
        id: target.id,
        directory: applicationFolder(target),
        command: target.startCommand
      })
      markStarted()
      return true
    } catch (error) {
      run.detach()
      run.state.value = 'failed'
      run.failure.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  async function stop(): Promise<void> {
    const target = toValue(project)
    try {
      await transport('project_stop', { id: target.id })
    } catch (error) {
      // A run that already exited needs no stopping; anything else is worth seeing.
      console.warn('[Runner] Stopping the application failed:', error)
    }
    run.state.value = 'idle'
    run.exitCode.value = null
    run.detach()
  }

  /** A window that reloaded picks the run it left up again instead of showing an idle project. */
  async function restore(): Promise<void> {
    const target = toValue(project)
    try {
      const pid = await transport('project_run', { id: target.id })
      if (typeof pid !== 'number') return
      run.state.value = 'running'
      await attach(target.id)
    } catch (error) {
      // A build without the native runner has nothing to ask; the screen stays idle.
      console.warn('[Runner] Asking for the running application failed:', error)
    }
  }

  void restore()

  return {
    state: run.state,
    output: run.output,
    failure: run.failure,
    exitCode: run.exitCode,
    running: active,
    address: computed(() => applicationAddress(toValue(project), run.output.value)),
    start,
    stop
  }
}

/**
 * Stop whatever a project runs, for a project that is no longer listed. The screen that started it
 * is gone with the project, so nothing of its own would ever ask for the stop.
 */
export async function stopProjectRun(
  id: string,
  transport: ProjectRunnerTransport = invoke
): Promise<void> {
  const run = runOf(id)
  run.detach()
  run.state.value = 'idle'
  run.exitCode.value = null
  try {
    await transport('project_stop', { id })
  } catch (error) {
    // A project that runs nothing needs no stopping; the removal goes ahead either way.
    console.warn('[Runner] Stopping a removed project failed:', error)
  }
}
